# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError
from odoo.tools import float_compare

from .shahtaj_gps import MAX_SHOP_DISTANCE_M, shahtaj_distance_meters

VISIT_STATES = [
    ('in_progress', 'In Progress'),
    ('completed', 'Completed'),
    ('cancelled', 'Cancelled'),
]

VISIT_OUTCOMES = [
    ('none', 'In Progress'),
    ('order', 'Order Placed'),
    ('no_order', 'No Order'),
]

BOOKER_VISIT_WRITABLE_FIELDS = frozenset({'line_ids', 'notes'})


class ShahtajVisit(models.Model):
    _name = 'shahtaj.visit'
    _description = 'Shop Visit'
    _order = 'started_at desc, id desc'

    name = fields.Char(compute='_compute_name', store=True)
    visit_task_id = fields.Many2one(
        'shahtaj.visit.task',
        string='Visit Task',
        required=True,
        ondelete='restrict',
        index=True,
    )
    order_booker_id = fields.Many2one(
        'res.users',
        string='Order Booker',
        required=True,
        index=True,
        ondelete='restrict',
    )
    shop_id = fields.Many2one(
        'res.partner',
        string='Shop',
        required=True,
        ondelete='restrict',
    )
    route_id = fields.Many2one(
        'shahtaj.route',
        string='Route',
        required=True,
        ondelete='restrict',
    )
    state = fields.Selection(
        VISIT_STATES,
        string='Status',
        default='in_progress',
        required=True,
        index=True,
    )
    outcome = fields.Selection(
        VISIT_OUTCOMES,
        string='Outcome',
        default='none',
        required=True,
    )
    started_at = fields.Datetime(string='Check-in Time', required=True, index=True)
    ended_at = fields.Datetime(string='End Time', readonly=True)
    duration_seconds = fields.Integer(
        string='Visit Duration (sec)',
        readonly=True,
        help='Time from GPS check-in until order placed or visit ended.',
    )
    duration_minutes = fields.Float(
        string='Visit Duration (min)',
        compute='_compute_duration_minutes',
        store=True,
    )
    check_in_latitude = fields.Float(string='Check-in Latitude', digits=(10, 7))
    check_in_longitude = fields.Float(string='Check-in Longitude', digits=(10, 7))
    check_in_distance_m = fields.Float(
        string='Distance at Check-in (m)',
        digits=(16, 2),
        readonly=True,
    )
    sale_order_id = fields.Many2one(
        'sale.order',
        string='Sales Order',
        readonly=True,
        copy=False,
    )
    order_amount = fields.Monetary(
        string='Order Total',
        related='sale_order_id.amount_total',
        currency_field='currency_id',
    )
    currency_id = fields.Many2one(
        'res.currency',
        related='shop_id.currency_id',
    )
    line_ids = fields.One2many(
        'shahtaj.visit.line',
        'visit_id',
        string='Order Lines',
    )
    notes = fields.Text()

    _sql_constraints = [
        (
            'visit_task_unique',
            'unique(visit_task_id)',
            'This visit task already has a shop visit record.',
        ),
    ]

    @api.depends('shop_id', 'started_at', 'order_booker_id')
    def _compute_name(self):
        for visit in self:
            shop = visit.shop_id.name or '?'
            booker = visit.order_booker_id.name or '?'
            when = fields.Datetime.to_string(visit.started_at) if visit.started_at else ''
            visit.name = f'{shop} — {booker} — {when}'

    @api.depends('duration_seconds', 'started_at', 'state')
    def _compute_duration_minutes(self):
        now = fields.Datetime.now()
        for visit in self:
            if visit.state == 'in_progress' and visit.started_at:
                visit.duration_minutes = (now - visit.started_at).total_seconds() / 60.0
            else:
                visit.duration_minutes = (visit.duration_seconds or 0) / 60.0

    def _is_booker_only_user(self):
        user = self.env.user
        return (
            user.has_group('shahtaj_order_booker.group_shahtaj_order_booker')
            and not user.has_group('shahtaj_order_booker.group_shahtaj_distributor')
            and not user.has_group('base.group_system')
        )

    def write(self, vals):
        if (
            self._is_booker_only_user()
            and not self.env.context.get('shahtaj_system_visit_write')
        ):
            extra = set(vals) - BOOKER_VISIT_WRITABLE_FIELDS
            if extra:
                raise ValidationError(_(
                    'You can only add products and notes during an active visit.'
                ))
        return super().write(vals)

    @api.model
    def _get_active_visit_for_user(self, user=None):
        user = user or self.env.user
        return self.search([
            ('order_booker_id', '=', user.id),
            ('state', '=', 'in_progress'),
        ], limit=1)

    @api.model
    def _validate_check_in_coordinates(self, shop, latitude, longitude):
        if not shop.partner_latitude or not shop.partner_longitude:
            raise UserError(_(
                'Shop "%(shop)s" has no GPS coordinates. '
                'Ask your distributor to set shop latitude and longitude.',
                shop=shop.name,
            ))
        if latitude is None or longitude is None:
            raise UserError(_('Your GPS coordinates are required to check in at the shop.'))
        if not (-90 <= latitude <= 90):
            raise ValidationError(_('GPS latitude must be between -90 and 90.'))
        if not (-180 <= longitude <= 180):
            raise ValidationError(_('GPS longitude must be between -180 and 180.'))
        distance = shahtaj_distance_meters(
            latitude, longitude,
            shop.partner_latitude, shop.partner_longitude,
        )
        if distance > MAX_SHOP_DISTANCE_M:
            raise UserError(_(
                'You are %(distance).0f m from shop "%(shop)s". '
                'You must be within %(max).0f m to start a visit.',
                distance=distance,
                shop=shop.name,
                max=MAX_SHOP_DISTANCE_M,
            ))
        return distance

    @api.model
    def create_from_task_checkin(self, task, latitude, longitude):
        """GPS check-in: create visit, start timer, mark task in progress."""
        task.ensure_one()
        if task.order_booker_id != self.env.user and not self.env.su:
            raise UserError(_('You can only check in to your own visit tasks.'))
        if task.state in ('completed', 'cancelled', 'skipped'):
            raise UserError(_('This visit task is already closed.'))
        existing = self.search([('visit_task_id', '=', task.id)], limit=1)
        if existing:
            if existing.state == 'in_progress':
                return existing
            raise UserError(_('This task already has a completed visit.'))
        active = self._get_active_visit_for_user(task.order_booker_id)
        if active:
            raise UserError(_(
                'Finish your current visit at "%(shop)s" before starting another.',
                shop=active.shop_id.name,
            ))
        distance = self._validate_check_in_coordinates(task.shop_id, latitude, longitude)
        now = fields.Datetime.now()
        visit = self.create({
            'visit_task_id': task.id,
            'order_booker_id': task.order_booker_id.id,
            'shop_id': task.shop_id.id,
            'route_id': task.route_id.id,
            'started_at': now,
            'check_in_latitude': latitude,
            'check_in_longitude': longitude,
            'check_in_distance_m': distance,
            'state': 'in_progress',
            'outcome': 'none',
        })
        task.with_context(shahtaj_system_visit_write=True).write({
            'state': 'in_progress',
            'visit_id': visit.id,
        })
        return visit

    def _finish_visit(self, outcome):
        self.ensure_one()
        if self.state != 'in_progress':
            raise UserError(_('Only an in-progress visit can be ended.'))
        now = fields.Datetime.now()
        duration = int((now - self.started_at).total_seconds())
        self.with_context(shahtaj_system_visit_write=True).write({
            'state': 'completed',
            'outcome': outcome,
            'ended_at': now,
            'duration_seconds': max(duration, 0),
        })
        self.visit_task_id.with_context(shahtaj_system_visit_write=True).write({
            'state': 'completed',
        })

    def _check_credit_limit(self, order_total):
        self.ensure_one()
        shop = self.shop_id
        if not shop.use_partner_credit_limit or not shop.credit_limit:
            return
        outstanding = shop.sudo().credit
        currency = shop.currency_id or self.env.company.currency_id
        if float_compare(
            outstanding + order_total,
            shop.credit_limit,
            precision_rounding=currency.rounding,
        ) > 0:
            raise UserError(_(
                'Credit limit exceeded for shop "%(shop)s". '
                'Outstanding: %(outstanding).2f, order: %(order).2f, limit: %(limit).2f.',
                shop=shop.name,
                outstanding=outstanding,
                order=order_total,
                limit=shop.credit_limit,
            ))

    def action_place_order(self):
        self.ensure_one()
        if self.state != 'in_progress':
            raise UserError(_('This visit is not in progress.'))
        if not self.line_ids:
            raise UserError(_('Add at least one product before placing an order.'))
        order_lines = []
        order_total = 0.0
        for line in self.line_ids:
            if line.product_uom_qty <= 0:
                raise UserError(_('Quantity must be greater than zero for all lines.'))
            subtotal = line.product_uom_qty * line.price_unit
            order_total += subtotal
            order_lines.append((0, 0, {
                'product_id': line.product_id.id,
                'product_uom_qty': line.product_uom_qty,
                'price_unit': line.price_unit,
            }))
        self._check_credit_limit(order_total)
        order = self.env['sale.order'].sudo().create({
            'partner_id': self.shop_id.id,
            'user_id': self.order_booker_id.id,
            'origin': _('Shop visit %s', self.display_name),
            'shahtaj_visit_id': self.id,
            'shahtaj_visit_task_id': self.visit_task_id.id,
            'order_line': order_lines,
        })
        order.sudo().action_confirm()
        self.with_context(shahtaj_system_visit_write=True).write({
            'sale_order_id': order.id,
        })
        self._finish_visit('order')
        if self._is_booker_only_user():
            return {
                'type': 'ir.actions.act_window',
                'name': _('Shop Visit'),
                'res_model': 'shahtaj.visit',
                'res_id': self.id,
                'view_mode': 'form',
                'target': 'current',
                'views': [
                    (self.env.ref('shahtaj_order_booker.view_shahtaj_visit_form_booker').id, 'form'),
                ],
            }
        return {
            'type': 'ir.actions.act_window',
            'name': _('Sales Order'),
            'res_model': 'sale.order',
            'res_id': order.id,
            'view_mode': 'form',
            'target': 'current',
        }

    def action_end_without_order(self):
        for visit in self:
            visit._finish_visit('no_order')
        return True


class ShahtajVisitLine(models.Model):
    _name = 'shahtaj.visit.line'
    _description = 'Shop Visit Order Line'
    _order = 'id'

    visit_id = fields.Many2one(
        'shahtaj.visit',
        string='Visit',
        required=True,
        ondelete='cascade',
    )
    product_id = fields.Many2one(
        'product.product',
        string='Product',
        required=True,
        domain=[('sale_ok', '=', True)],
    )
    product_uom_qty = fields.Float(
        string='Quantity',
        default=1.0,
        required=True,
        digits='Product Unit of Measure',
    )
    price_unit = fields.Float(
        string='Unit Price',
        digits='Product Price',
    )
    subtotal = fields.Float(
        string='Subtotal',
        compute='_compute_subtotal',
    )

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if self.product_id:
            self.price_unit = self.product_id.lst_price

    @api.depends('product_uom_qty', 'price_unit')
    def _compute_subtotal(self):
        for line in self:
            line.subtotal = line.product_uom_qty * line.price_unit
