# -*- coding: utf-8 -*-
import math

from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError
from odoo.tools import float_is_zero

MAX_REGISTRATION_DISTANCE_M = 100.0

# Allow Shahtaj roles to use accounting credit fields on shops without Invoicing app rights.
_SHAHTAJ_CREDIT_GROUPS = (
    'account.group_account_invoice,account.group_account_readonly,'
    'shahtaj_order_booker.group_shahtaj_distributor,'
    'shahtaj_order_booker.group_shahtaj_order_booker'
)


class ResPartner(models.Model):
    _inherit = 'res.partner'

    credit_limit = fields.Float(groups=_SHAHTAJ_CREDIT_GROUPS)
    use_partner_credit_limit = fields.Boolean(groups=_SHAHTAJ_CREDIT_GROUPS)

    is_shahtaj_shop = fields.Boolean(string='Is Shop')
    shop_approval_state = fields.Selection(
        [
            ('pending', 'Pending'),
            ('approved', 'Approved'),
            ('rejected', 'Rejected'),
        ],
        string='Shop Approval',
        default='pending',
    )
    owner_name = fields.Char(string='Owner Name')
    owner_phone = fields.Char(string='Owner Phone')
    zone_id = fields.Many2one(
        'shahtaj.zone',
        string='Zone',
        ondelete='set null',
        domain=lambda self: [('id', 'in', self._get_allowed_zone_ids())],
    )
    route_id = fields.Many2one(
        'shahtaj.route',
        string='Route',
        ondelete='set null',
        domain="[('id', 'in', allowed_route_ids)]",
    )
    route_ids = fields.Many2many(
        'shahtaj.route',
        'shahtaj_route_partner_rel',
        'partner_id',
        'route_id',
        string='Routes',
    )
    registered_by_id = fields.Many2one(
        'res.users',
        string='Registered By',
        readonly=True,
        copy=False,
    )
    registration_user_latitude = fields.Float(
        string='Registration Booker Latitude',
        digits=(10, 7),
        copy=False,
    )
    registration_user_longitude = fields.Float(
        string='Registration Booker Longitude',
        digits=(10, 7),
        copy=False,
    )
    legacy_balance = fields.Monetary(
        string='Legacy Balance',
        currency_field='currency_id',
        help='Outstanding balance from before the system. Posted to accounting when the shop is approved.',
    )
    legacy_balance_move_id = fields.Many2one(
        'account.move',
        string='Legacy Balance Entry',
        readonly=True,
        copy=False,
        ondelete='restrict',
    )
    outstanding_balance = fields.Monetary(
        string='Outstanding Balance',
        compute='_compute_outstanding_balance',
        currency_field='currency_id',
        help='Total receivable from accounting (includes legacy balance once posted).',
    )
    owner_cnic_front = fields.Image(string='Owner CNIC Front', max_width=1920, max_height=1920)
    owner_cnic_back = fields.Image(string='Owner CNIC Back', max_width=1920, max_height=1920)
    owner_photo = fields.Image(string='Owner Photo', max_width=1920, max_height=1920)
    shop_exterior_photo = fields.Image(string='Shop Exterior Photo', max_width=1920, max_height=1920)
    allowed_zone_ids = fields.Many2many(
        'shahtaj.zone',
        compute='_compute_allowed_zones_routes',
    )
    allowed_route_ids = fields.Many2many(
        'shahtaj.route',
        compute='_compute_allowed_zones_routes',
    )

    @api.model
    def _get_order_booker_routes(self):
        """Routes assigned to this booker via weekly schedules."""
        Schedule = self.env['shahtaj.weekly.schedule']
        return Schedule.search([
            ('order_booker_id', '=', self.env.uid),
            ('active', '=', True),
        ]).mapped('route_id').filtered('active')

    @api.model
    def _get_allowed_zone_ids(self):
        Zone = self.env['shahtaj.zone']
        if self._is_order_booker_only():
            return self._get_order_booker_routes().mapped('zone_id').ids
        return Zone.search([('active', '=', True)]).ids

    @api.model
    def _get_allowed_route_ids(self, zone_id=None):
        if self._is_order_booker_only():
            routes = self._get_order_booker_routes()
        else:
            routes = self.env['shahtaj.route'].search([('active', '=', True)])
        if zone_id:
            routes = routes.filtered(lambda r: r.zone_id.id == zone_id)
        return routes.ids

    @api.depends('zone_id')
    @api.depends_context('uid')
    def _compute_allowed_zones_routes(self):
        zone_ids = self._get_allowed_zone_ids()
        zones = self.env['shahtaj.zone'].browse(zone_ids)
        for partner in self:
            partner.allowed_zone_ids = zones
            zone_id = partner.zone_id.id if partner.zone_id else None
            route_ids = self._get_allowed_route_ids(zone_id=zone_id)
            partner.allowed_route_ids = self.env['shahtaj.route'].browse(route_ids)

    @api.model
    def _is_order_booker_only(self):
        user = self.env.user
        if user.has_group('base.group_system'):
            return False
        if user.has_group('shahtaj_order_booker.group_shahtaj_distributor'):
            return False
        return user.has_group('shahtaj_order_booker.group_shahtaj_order_booker')

    @api.depends('legacy_balance_move_id')
    def _compute_outstanding_balance(self):
        for partner in self:
            partner.outstanding_balance = partner.sudo().credit

    @api.onchange('zone_id')
    def _onchange_zone_id(self):
        if self.route_id and self.route_id.zone_id != self.zone_id:
            self.route_id = False
        route_ids = self._get_allowed_route_ids(
            zone_id=self.zone_id.id if self.zone_id else None,
        )
        return {'domain': {'route_id': [('id', 'in', route_ids)]}}

    @api.onchange('route_id')
    def _onchange_route_id(self):
        if self.route_id:
            self.zone_id = self.route_id.zone_id

    @api.onchange('owner_phone')
    def _onchange_owner_phone(self):
        if self.owner_phone:
            self.phone = self.owner_phone

    @api.constrains(
        'is_shahtaj_shop', 'registration_user_latitude', 'registration_user_longitude',
        'partner_latitude', 'partner_longitude', 'registered_by_id', 'shop_approval_state',
    )
    def _check_registration_gps_required(self):
        for partner in self.filtered(lambda p: p._needs_registration_gps_check()):
            partner._validate_registration_gps()

    @api.constrains('partner_latitude', 'partner_longitude')
    def _check_shop_gps_range(self):
        for partner in self.filtered('is_shahtaj_shop'):
            if partner.partner_latitude and not (-90 <= partner.partner_latitude <= 90):
                raise ValidationError(_('GPS latitude must be between -90 and 90.'))
            if partner.partner_longitude and not (-180 <= partner.partner_longitude <= 180):
                raise ValidationError(_('GPS longitude must be between -180 and 180.'))

    @api.model
    def _distance_meters(self, lat1, lon1, lat2, lon2):
        radius = 6371000.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = (
            math.sin(dphi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        )
        return 2 * radius * math.asin(math.sqrt(a))

    def _needs_registration_gps_check(self):
        """Booker-at-shop GPS check disabled at registration (visit-time GPS in Phase 2)."""
        return False

    def _validate_registration_gps(self):
        """Legacy hook — registration no longer requires booker GPS."""
        return

    def _validate_shop_required_fields(self):
        for partner in self.filtered('is_shahtaj_shop'):
            if not partner.name:
                raise ValidationError(_('Shop name is required.'))
            if not partner.owner_name:
                raise ValidationError(_('Owner name is required.'))
            if not partner.owner_phone:
                raise ValidationError(_('Owner phone is required.'))
            if not partner.partner_latitude or not partner.partner_longitude:
                raise ValidationError(_('Shop GPS latitude and longitude are required.'))

    def _prepare_shop_vals(self, vals):
        vals = dict(vals)
        if vals.get('is_shahtaj_shop') or self.env.context.get('shahtaj_shop_form'):
            vals.setdefault('is_shahtaj_shop', True)
            vals.setdefault('company_type', 'company')
            vals.setdefault('customer_rank', 1)
            if vals.get('owner_phone'):
                vals.setdefault('phone', vals['owner_phone'])
            if self.env.context.get('shahtaj_shop_register'):
                vals.setdefault('shop_approval_state', 'pending')
                vals.setdefault('registered_by_id', self.env.user.id)
            elif self.env.context.get('default_shop_approval_state'):
                vals.setdefault(
                    'shop_approval_state',
                    self.env.context['default_shop_approval_state'],
                )
            credit = vals.get('credit_limit', 0) or 0
            if credit > 0:
                vals['use_partner_credit_limit'] = True
        return vals

    def _sync_route_assignment(self):
        Route = self.env['shahtaj.route'].sudo()
        for partner in self:
            if partner.route_id and partner.id not in partner.route_id.shop_ids.ids:
                Route.browse(partner.route_id.id).write({'shop_ids': [(4, partner.id)]})

    def _post_legacy_balance_entry(self):
        """Post opening receivable for legacy balance to Odoo accounting."""
        AccountMove = self.env['account.move'].sudo()
        AccountJournal = self.env['account.journal'].sudo()
        for partner in self.filtered(
            lambda p: p.is_shahtaj_shop
            and p.shop_approval_state == 'approved'
            and p.legacy_balance
            and not p.legacy_balance_move_id
        ):
            company = partner.company_id or self.env.company
            partner = partner.with_company(company)
            if float_is_zero(
                partner.legacy_balance,
                precision_rounding=(partner.currency_id or company.currency_id).rounding,
            ):
                continue
            receivable = partner.sudo().property_account_receivable_id
            if not receivable:
                raise UserError(_(
                    'No receivable account configured for shop "%(shop)s". '
                    'Install accounting chart or set a receivable account on the contact.',
                    shop=partner.name,
                ))
            journal = AccountJournal.search([
                ('type', '=', 'general'),
                ('company_id', '=', company.id),
            ], limit=1)
            if not journal:
                raise UserError(_(
                    'No miscellaneous journal found. Install accounting before setting legacy balance.'
                ))
            equity_account = company.sudo().get_unaffected_earnings_account()
            move = AccountMove.create({
                'move_type': 'entry',
                'journal_id': journal.id,
                'date': fields.Date.context_today(self),
                'ref': _('Legacy shop balance: %s', partner.name),
                'line_ids': [
                    (0, 0, {
                        'name': _('Legacy balance'),
                        'partner_id': partner.id,
                        'account_id': receivable.id,
                        'debit': partner.legacy_balance,
                        'credit': 0.0,
                    }),
                    (0, 0, {
                        'name': _('Legacy balance'),
                        'account_id': equity_account.id,
                        'debit': 0.0,
                        'credit': partner.legacy_balance,
                    }),
                ],
            })
            move.action_post()
            partner.with_context(shahtaj_posting_legacy_move=True).write({
                'legacy_balance_move_id': move.id,
            })

    @api.model_create_multi
    def create(self, vals_list):
        prepared = [self._prepare_shop_vals(vals) for vals in vals_list]
        partners = super().create(prepared)
        shop_partners = partners.filtered('is_shahtaj_shop')
        shop_partners._validate_shop_required_fields()
        shop_partners._sync_route_assignment()
        shop_partners.filtered(
            lambda p: p.shop_approval_state == 'approved'
        )._post_legacy_balance_entry()
        return partners

    def write(self, vals):
        if vals.get('owner_phone'):
            vals.setdefault('phone', vals['owner_phone'])
        if vals.get('credit_limit', 0) > 0:
            vals['use_partner_credit_limit'] = True
        if vals.get('legacy_balance_move_id') and not self.env.context.get(
            'shahtaj_posting_legacy_move'
        ):
            raise UserError(_('Legacy balance journal entry cannot be changed manually.'))
        res = super().write(vals)
        if any(k in vals for k in ('is_shahtaj_shop', 'name', 'owner_name', 'owner_phone',
                                    'partner_latitude', 'partner_longitude')):
            self.filtered('is_shahtaj_shop')._validate_shop_required_fields()
        if 'route_id' in vals:
            self._sync_route_assignment()
        if 'legacy_balance' in vals:
            self.filtered(
                lambda p: p.shop_approval_state == 'approved' and not p.legacy_balance_move_id
            )._post_legacy_balance_entry()
        return res

    def action_approve_shop(self):
        pending = self.filtered(lambda p: p.shop_approval_state != 'approved')
        pending.write({'shop_approval_state': 'approved', 'is_shahtaj_shop': True})
        pending._post_legacy_balance_entry()

    def action_reject_shop(self):
        self.write({'shop_approval_state': 'rejected'})

    def action_view_legacy_balance_move(self):
        self.ensure_one()
        if not self.legacy_balance_move_id:
            raise UserError(_('No legacy balance journal entry exists for this shop.'))
        return {
            'type': 'ir.actions.act_window',
            'name': _('Legacy Balance Entry'),
            'res_model': 'account.move',
            'res_id': self.legacy_balance_move_id.id,
            'view_mode': 'form',
            'target': 'current',
        }
