import frappe
from frappe.model.utils.rename_field import rename_field

def execute():
	frappe.db.sql("""update `tabLeave Type` set max_days_allowed = '0' where trim(coalesce(max_days_allowed, '')) = ''""")
	frappe.reload_doc("hr", "doctype", "leave_type")
	frappe.db.sql_ddl("""ALTER table `tabLeave Type` modify max_days_allowed int(8) NOT NULL""")
	rename_field("Leave Type", "max_days_allowed", "max_continuous_days_allowed") 
