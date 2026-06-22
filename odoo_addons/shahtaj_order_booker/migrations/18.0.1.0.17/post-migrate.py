# -*- coding: utf-8 -*-

def migrate(cr, version):
    cr.execute("""
        ALTER TABLE shahtaj_route
        DROP COLUMN IF EXISTS order_booker_id
    """)
