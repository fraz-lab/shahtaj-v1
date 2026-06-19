# -*- coding: utf-8 -*-
from odoo import fields, models
from odoo.http import request


class IrHttp(models.AbstractModel):
    _inherit = 'ir.http'

    def session_info(self):
        if request.session.uid:
            user = request.env.user
            if user.has_group('tulip_order_booker.group_shahtaj_order_booker'):
                user.sudo().write({
                    'shahtaj_last_seen_at': fields.Datetime.now(),
                })
                request.env['shahtaj.visit.task'].sudo()._auto_generate_window(
                    order_booker=user,
                )
        return super().session_info()
