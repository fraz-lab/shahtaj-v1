# -*- coding: utf-8 -*-
"""Upgrade: rename module tulip_order_booker → shahtaj_order_booker in registry."""

def migrate(cr, version):
    """Rename module technical name from tulip_order_booker to shahtaj_order_booker."""
    cr.execute(
        """
        UPDATE ir_module_module
           SET name = 'shahtaj_order_booker'
         WHERE name = 'tulip_order_booker'
        """
    )
    cr.execute(
        """
        UPDATE ir_model_data
           SET module = 'shahtaj_order_booker'
         WHERE module = 'tulip_order_booker'
        """
    )
    cr.execute(
        """
        UPDATE ir_module_module_dependency
           SET name = 'shahtaj_order_booker'
         WHERE name = 'tulip_order_booker'
        """
    )
