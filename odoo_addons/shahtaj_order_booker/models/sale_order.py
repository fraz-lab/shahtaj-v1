# -*- coding: utf-8 -*-
from odoo import fields, models


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    shahtaj_visit_id = fields.Many2one(
        'shahtaj.visit',
        string='Shop Visit',
        ondelete='set null',
        copy=False,
        index=True,
    )
    shahtaj_visit_task_id = fields.Many2one(
        'shahtaj.visit.task',
        string='Visit Task',
        ondelete='set null',
        copy=False,
        index=True,
    )
