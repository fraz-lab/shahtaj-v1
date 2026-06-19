# -*- coding: utf-8 -*-
# from odoo import http


# class TulipOrderBooker(http.Controller):
#     @http.route('/tulip_order_booker/tulip_order_booker', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/tulip_order_booker/tulip_order_booker/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('tulip_order_booker.listing', {
#             'root': '/tulip_order_booker/tulip_order_booker',
#             'objects': http.request.env['tulip_order_booker.tulip_order_booker'].search([]),
#         })

#     @http.route('/tulip_order_booker/tulip_order_booker/objects/<model("tulip_order_booker.tulip_order_booker"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('tulip_order_booker.object', {
#             'object': obj
#         })

