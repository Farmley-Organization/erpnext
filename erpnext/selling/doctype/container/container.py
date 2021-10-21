# Copyright (c) 2021, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Container(Document):
	def validate(self):
		self.weight_cbm_percentage()

	@frappe.whitelist()
	def delivery_note(self):
		adoc=[]
		for i in self.ventures_list:
			adoc.append(i.venture_id)
		adoc=set(adoc)
		adoc=list(adoc)
		for j in adoc:
			cdoc=frappe.db.get_all("Ventures",{"parent":self.name,"venture_id":j},["name"])
			for k in cdoc:
				vdoc=frappe.get_doc("Ventures",{"name":k.name})
				sdoc=frappe.get_doc("Sales Order",vdoc.order_no)
				doc=frappe.new_doc("Delivery Note")
				doc.customer=vdoc.venture_id
				doc.container = self.name
				doc.transporter = sdoc.transporter
				idoc=frappe.get_doc("Item",vdoc.product)
				doc.append('items', {
						'item_code': vdoc.product,
						'warehouse': self.warehouse,
						'qty': vdoc.venture_qty,
						'stock_qty': vdoc.venture_qty,
						'uom': idoc.stock_uom,
						'stock_uom': idoc.stock_uom,
						'conversion_factor':1,
						'against_sales_order': vdoc.order_no,
						"warehouse":vdoc.warehouse
					})

				if sdoc.additional_discount_percentage:
					doc.additional_discount_percentage = sdoc.additional_discount_percentage

				if sdoc.apply_discount_on:	
					doc.apply_dicount_on = sdoc.apply_discount_on

				if sdoc.taxes_and_charges:
					doc.taxes_and_charges = sdoc.taxes_and_charges

				
				if sdoc.tc_name:	
					doc.tc_name = sdoc.tc_name

				
				if sdoc.transporter:	
					doc.transporter = sdoc.transporter

				for i in sdoc.taxes:
					doc.append('taxes', {
						"category":i.category,
						"add_deduct_tax":i.add_deduct_tax,
						"charge_type":i.charge_type,
						"row_id":i.row_id,
						"included_in_print_rate":i.included_in_print_rate,
						"included_in_paid_amount":i.included_in_paid_amount,
						"description":i.description,
						"account_head":i.account_head,
						"cost_center":i.cost_center
					})
				
				doc._action = "save"
				doc.validate()
				doc.insert()

			
				
				frappe.db.commit()				
				

		return True
	
				
	
	@frappe.whitelist()
	def purchase_receipt(self):
		adoc=[]
		for i in self.ventures_list:
			adoc.append(i.venture_id)
		adoc=set(adoc)
		adoc=list(adoc)
		for j in adoc:
			cdoc=frappe.db.get_all("Ventures",{"parent":self.name,"venture_id":j},["name"])
			for k in cdoc:
				vdoc=frappe.get_doc("Ventures",{"name":k.name})
				pdoc=frappe.get_doc("Purchase Order",vdoc.order_no)
				doc=frappe.new_doc("Purchase Receipt")
				doc.supplier=vdoc.venture_id
				doc.container = self.name
				# doc.transporter = pdoc.transporter
				idoc=frappe.get_doc("Item",vdoc.product)
				doc.append('items', {
						'item_code': vdoc.product,
						'warehouse': self.warehouse,
						'qty': vdoc.venture_qty,
						'stock_qty': vdoc.venture_qty,
						'uom': idoc.stock_uom,
						'stock_uom': idoc.stock_uom,
						'conversion_factor':1,
						'purchase_order': vdoc.order_no,
						"warehouse":vdoc.warehouse
					})

				if pdoc.additional_discount_percentage:
					doc.additional_discount_percentage = pdoc.additional_discount_percentage

				if pdoc.apply_discount_on:	
					doc.apply_dicount_on = pdoc.apply_discount_on

				if pdoc.taxes_and_charges:
					doc.taxes_and_charges = pdoc.taxes_and_charges
				for i in pdoc.taxes:
					doc.append('taxes', {
						"category":i.category,
						"add_deduct_tax":i.add_deduct_tax,
						"charge_type":i.charge_type,
						"row_id":i.row_id,
						"included_in_print_rate":i.included_in_print_rate,
						"included_in_paid_amount":i.included_in_paid_amount,
						"description":i.description,
						"account_head":i.account_head,
						"cost_center":i.cost_center
					})
				# if pdoc.tc_name:	
				# 	doc.tc_name = pdoc.tc_name

				
				# if pdoc.transporter:	
				# 	doc.transporter = pdoc.transporter

				
				doc._action = "save"
				doc.validate()
				doc.insert()

			
				
				frappe.db.commit()				
				

		return True
	
				

	def weight_cbm_percentage(self):
		if self.container_type:
			doc=frappe.get_doc("Container Type",self.container_type)
			weight=[]
			cbm=[]
			for i in self.ventures_list:
				weight.append(i.total_weight)
				cbm.append(i.total_cbm)
			a=sum(weight)
			b=sum(cbm)
			tweight=a/doc.max_allowed_weight*100
			tcbm=b/doc.max_cbm*100
			print(tweight)
			print(tcbm)
			if tweight  < 100 and tcbm <100:
				self.weight_percentage=tweight
				self.cbm_percentage=tcbm
			else:
				frappe.throw("Container weight percentage Or cbm percentage should be <=100")

	@frappe.whitelist()
	def set_updating_qty(self):
		for i in self.ventures_list:
			if i.warehouse and i.product:
				doc=frappe.db.get_all("Bin",{"item_code":i.product,"warehouse":i.warehouse},["projected_qty"])
				for j in doc:
					qty=[]
					qty.append(j.projected_qty)
				i.qty_ordered=sum(qty)
		return True



	@frappe.whitelist()
	def make_landed_cost_voucher(self):
		doc=frappe.new_doc("Landed Cost Voucher")
		pdoc=frappe.db.get_all("Purchase Receipt",{"container":self.name},["name"])
		for i in pdoc:
			doc.append('purchase_receipts', {
				"receipt_document_type":"Purchase Receipt",
				"receipt_document":i.name
			})
		return True
		# doc.insert(ignore_permissions=True)