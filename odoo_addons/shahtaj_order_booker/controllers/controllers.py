# -*- coding: utf-8 -*-
# Placeholder for future HTTP/API routes (mobile app). Not used yet.
# from odoo import http


# class ShahtajOrderBooker(http.Controller):
#     @http.route('/shahtaj_order_booker/shahtaj_order_booker', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/shahtaj_order_booker/shahtaj_order_booker/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('shahtaj_order_booker.listing', {
#             'root': '/shahtaj_order_booker/shahtaj_order_booker',
#             'objects': http.request.env['shahtaj_order_booker.shahtaj_order_booker'].search([]),
#         })

#     @http.route('/shahtaj_order_booker/shahtaj_order_booker/objects/<model("shahtaj_order_booker.shahtaj_order_booker"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('shahtaj_order_booker.object', {
#             'object': obj
#         })

