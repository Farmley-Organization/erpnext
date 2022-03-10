// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt

{% include 'erpnext/public/js/controllers/buying.js' %};

frappe.provide("erpnext.stock");

frappe.ui.form.on("Purchase Receipt", {
	setup: (frm) => {
		frm.make_methods = {
			'Landed Cost Voucher': () => {
				let lcv = frappe.model.get_new_doc('Landed Cost Voucher');
				lcv.company = frm.doc.company;

				let lcv_receipt = frappe.model.get_new_doc('Landed Cost Purchase Receipt');
				lcv_receipt.receipt_document_type = 'Purchase Receipt';
				lcv_receipt.receipt_document = frm.doc.name;
				lcv_receipt.supplier = frm.doc.supplier;
				lcv_receipt.grand_total = frm.doc.grand_total;
				lcv.purchase_receipts = [lcv_receipt];

				frappe.set_route("Form", lcv.doctype, lcv.name);
			},
		}

		frm.custom_make_buttons = {
			'Stock Entry': 'Return',
			'Purchase Invoice': 'Purchase Invoice'
		};

		frm.set_query("expense_account", "items", function() {
			return {
				query: "erpnext.controllers.queries.get_expense_account",
				filters: {'company': frm.doc.company }
			}
		});

		frm.set_query("taxes_and_charges", function() {
			return {
				filters: {'company': frm.doc.company }
			}
		});

	},
	onload: function(frm) {
		erpnext.queries.setup_queries(frm, "Warehouse", function() {
			return erpnext.queries.warehouse(frm.doc);
		});

		erpnext.accounts.dimensions.setup_dimension_filters(frm, frm.doctype);

	},

	// new code for TASK - TASK-2022-00015
	get_items: function(frm) {
		console.log(" Button Working")
		if (frm.doc.docstatus != 1){
			frm.clear_table("supplied_items")
			frappe.call({
				method : 'on_get_items_button',
				doc:frm.doc,
				callback: function(r)
				{
					// frm.refresh_field("get_items")
					if (r.message){
					console.log("this is buttom", r.message)
					frm.refresh_field("supplied_items")

					frm.set_value("is_subcontracted_clicked", 1)
					frm.refresh_field("is_subcontracted_clicked")

					}
					else console.log("Nothis ins ")
				}
			});
		}
		else console.log("Cannot Get ITEMS as document already is submitted")
	},



	refresh: function(frm) {
		// new code for TASK - TASK-2022-00015
		//  To unhide new button on Material  
		var for_challan_number_date = 0
		var po =  frm.doc.items[0].purchase_order
		if (po){
			frappe.call({
				method : 'to_button_hide',
				doc:frm.doc,
				args: {
					po : po
				},
				callback: function(r)
				{
					// frm.refresh_field("get_items")
					console.log("this is buttom")
					if (r.message){
						for_challan_number_date = 1
						frm.set_df_property("get_items", "hidden", 0)
					}
				}
			});
			
		}
		// console.log(" thi uis is_supply_rm", is_supply_rm)
		// 

		if(frm.doc.company) {
			frm.trigger("toggle_display_account_head");
		}

		if (frm.doc.docstatus === 1 && frm.doc.is_return === 1 && frm.doc.per_billed !== 100) {
			frm.add_custom_button(__('Debit Note'), function() {
				frappe.model.open_mapped_doc({
					method: "erpnext.stock.doctype.purchase_receipt.purchase_receipt.make_purchase_invoice",
					frm: cur_frm,
				})
			}, __('Create'));
			frm.page.set_inner_btn_group_as_primary(__('Create'));
		}

		if (frm.doc.docstatus === 1 && frm.doc.is_internal_supplier && !frm.doc.inter_company_reference) {
			frm.add_custom_button(__('Delivery Note'), function() {
				frappe.model.open_mapped_doc({
					method: 'erpnext.stock.doctype.purchase_receipt.purchase_receipt.make_inter_company_delivery_note',
					frm: cur_frm,
				})
			}, __('Create'));
		}

		frm.events.add_custom_buttons(frm);
	},


	add_custom_buttons: function(frm) {
		if (frm.doc.docstatus == 0) {
			frm.add_custom_button(__('Purchase Invoice'), function () {
				if (!frm.doc.supplier) {
					frappe.throw({
						title: __("Mandatory"),
						message: __("Please Select a Supplier")
					});
				}
				erpnext.utils.map_current_doc({
					method: "erpnext.accounts.doctype.purchase_invoice.purchase_invoice.make_purchase_receipt",
					source_doctype: "Purchase Invoice",
					target: frm,
					setters: {
						supplier: frm.doc.supplier,
					},
					get_query_filters: {
						docstatus: 1,
						per_received: ["<", 100],
						company: frm.doc.company
					}
				})
			}, __("Get Items From"));
		}
	},
	tax_category:function(frm){
		frm.call({
			method:"calculate_taxes",
			doc:frm.doc,
			callback: function(r)
			{

                frm.refresh_field("items")
			}
		});
	},
	shipping_address:function(frm){
		frm.call({
			method:"calculate_taxes",
			doc:frm.doc,
			callback: function(r)
			{

                frm.set_value("tax_category","");
				frm.refresh_field("tax_category")
                frm.set_value("tax_category",r.message);
                frm.refresh_field("tax_category")
			}
		});
	},
	supplier_address:function(frm){
		frm.call({
			method:"calculate_taxes",
			doc:frm.doc,
			callback: function(r)
			{

                frm.set_value("tax_category","");
				frm.refresh_field("tax_category")
                frm.set_value("tax_category",r.message);
                refresh_field("tax_category")
			}
		});
	},
	customer_address:function(frm){
		frm.call({
			method:"calculate_taxes",
			doc:frm.doc,
			callback: function(r)
			{

                frm.set_value("tax_category","");
				frm.refresh_field("tax_category")
                frm.set_value("tax_category",r.message);
                refresh_field("tax_category")
			}
		});
	},
	billing_address:function(frm){
		frm.call({
			method:"calculate_taxes",
			doc:frm.doc,
			callback: function(r)
			{

                frm.set_value("tax_category","");
				frm.refresh_field("tax_category")
                frm.set_value("tax_category",r.message);
                refresh_field("tax_category")
			}
		});
	},
	branch:function(frm){
		frm.call({
			method:"calculate_taxes",
			doc:frm.doc,
			callback: function(r)
			{

				frm.set_value("tax_category","");
				frm.refresh_field("tax_category")
                frm.set_value("tax_category",r.message);
                refresh_field("tax_category")
			}
		});
	},
	location:function(frm){
		frm.call({
			method:"calculate_taxes",
			doc:frm.doc,
			callback: function(r)
			{

				frm.set_value("tax_category","");
				frm.refresh_field("tax_category")
                frm.set_value("tax_category",r.message);
                refresh_field("tax_category")
			}
		});
	},
	cost_center:function(frm){
		frm.call({
			method:"calculate_taxes",
			doc:frm.doc,
			callback: function(r)
			{

				frm.set_value("tax_category","");
				frm.refresh_field("tax_category")
                frm.set_value("tax_category",r.message);
                refresh_field("tax_category")
			}
		});
	},
	company: function(frm) {
		frm.trigger("toggle_display_account_head");
		erpnext.accounts.dimensions.update_dimension(frm, frm.doctype);
	},



	toggle_display_account_head: function(frm) {
		var enabled = erpnext.is_perpetual_inventory_enabled(frm.doc.company)
		frm.fields_dict["items"].grid.set_column_disp(["cost_center"], enabled);
	}
});

erpnext.stock.PurchaseReceiptController = erpnext.buying.BuyingController.extend({
	setup: function(doc) {
		this.setup_posting_date_time_check();
		this._super(doc);
	},

	refresh: function() {
		var me = this;
		this._super();
		if(this.frm.doc.docstatus > 0) {
			this.show_stock_ledger();
			//removed for temporary
			this.show_general_ledger();

			this.frm.add_custom_button(__('Asset'), function() {
				frappe.route_options = {
					purchase_receipt: me.frm.doc.name,
				};
				frappe.set_route("List", "Asset");
			}, __("View"));

			this.frm.add_custom_button(__('Asset Movement'), function() {
				frappe.route_options = {
					reference_name: me.frm.doc.name,
				};
				frappe.set_route("List", "Asset Movement");
			}, __("View"));
		}

		if(!this.frm.doc.is_return && this.frm.doc.status!="Closed") {
			if (this.frm.doc.docstatus == 0) {
				this.frm.add_custom_button(__('Purchase Order'),
					function () {
						if (!me.frm.doc.supplier) {
							frappe.throw({
								title: __("Mandatory"),
								message: __("Please Select a Supplier")
							});
						}
						erpnext.utils.map_current_doc({
							method: "erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_receipt",
							source_doctype: "Purchase Order",
							target: me.frm,
							setters: {
								supplier: me.frm.doc.supplier,
								schedule_date: undefined
							},
							get_query_filters: {
								docstatus: 1,
								status: ["not in", ["Closed", "On Hold"]],
								per_received: ["<", 99.99],
								company: me.frm.doc.company
							}
						})
					}, __("Get Items From"));
			}

			if(this.frm.doc.docstatus == 1 && this.frm.doc.status!="Closed") {
				if (this.frm.has_perm("submit")) {
					cur_frm.add_custom_button(__("Close"), this.close_purchase_receipt, __("Status"))
				}

				cur_frm.add_custom_button(__('Purchase Return'), this.make_purchase_return, __('Create'));

				cur_frm.add_custom_button(__('Make Stock Entry'), cur_frm.cscript['Make Stock Entry'], __('Create'));

				if(flt(this.frm.doc.per_billed) < 100) {
					cur_frm.add_custom_button(__('Purchase Invoice'), this.make_purchase_invoice, __('Create'));
				}
				cur_frm.add_custom_button(__('Retention Stock Entry'), this.make_retention_stock_entry, __('Create'));

				if(!this.frm.doc.auto_repeat) {
					cur_frm.add_custom_button(__('Subscription'), function() {
						erpnext.utils.make_subscription(me.frm.doc.doctype, me.frm.doc.name)
					}, __('Create'))
				}

				cur_frm.page.set_inner_btn_group_as_primary(__('Create'));
			}
		}


		if(this.frm.doc.docstatus==1 && this.frm.doc.status === "Closed" && this.frm.has_perm("submit")) {
			cur_frm.add_custom_button(__('Reopen'), this.reopen_purchase_receipt, __("Status"))
		}

		this.frm.toggle_reqd("supplier_warehouse", this.frm.doc.is_subcontracted==="Yes");
	},


	make_purchase_invoice: function() {
		frappe.model.open_mapped_doc({
			method: "erpnext.stock.doctype.purchase_receipt.purchase_receipt.make_purchase_invoice",
			frm: cur_frm
		})
	},

	make_purchase_return: function() {
		frappe.model.open_mapped_doc({
			method: "erpnext.stock.doctype.purchase_receipt.purchase_receipt.make_purchase_return",
			frm: cur_frm
		})
	},

	close_purchase_receipt: function() {
		cur_frm.cscript.update_status("Closed");
	},

	reopen_purchase_receipt: function() {
		cur_frm.cscript.update_status("Submitted");
	},

	make_retention_stock_entry: function() {
		frappe.call({
			method: "erpnext.stock.doctype.stock_entry.stock_entry.move_sample_to_retention_warehouse",
			args:{
				"company": cur_frm.doc.company,
				"items": cur_frm.doc.items
			},
			callback: function (r) {
				if (r.message) {
					var doc = frappe.model.sync(r.message)[0];
					frappe.set_route("Form", doc.doctype, doc.name);
				}
				else {
					frappe.msgprint(__("Purchase Receipt doesn't have any Item for which Retain Sample is enabled."));
				}
			}
		});
	},

	apply_putaway_rule: function() {
		if (this.frm.doc.apply_putaway_rule) erpnext.apply_putaway_rule(this.frm);
	}

});

// for backward compatibility: combine new and previous states
$.extend(cur_frm.cscript, new erpnext.stock.PurchaseReceiptController({frm: cur_frm}));

cur_frm.cscript.update_status = function(status) {
	frappe.ui.form.is_saving = true;
	frappe.call({
		method:"erpnext.stock.doctype.purchase_receipt.purchase_receipt.update_purchase_receipt_status",
		args: {docname: cur_frm.doc.name, status: status},
		callback: function(r){
			if(!r.exc)
				cur_frm.reload_doc();
		},
		always: function(){
			frappe.ui.form.is_saving = false;
		}
	})
}

cur_frm.fields_dict['items'].grid.get_field('project').get_query = function(doc, cdt, cdn) {
	return {
		filters: [
			['Project', 'status', 'not in', 'Completed, Cancelled']
		]
	}
}

cur_frm.fields_dict['select_print_heading'].get_query = function(doc, cdt, cdn) {
	return {
		filters: [
			['Print Heading', 'docstatus', '!=', '2']
		]
	}
}

cur_frm.fields_dict['items'].grid.get_field('bom').get_query = function(doc, cdt, cdn) {
	var d = locals[cdt][cdn]
	return {
		filters: [
			['BOM', 'item', '=', d.item_code],
			['BOM', 'is_active', '=', '1'],
			['BOM', 'docstatus', '=', '1'],
			['BOM', 'company', '=', doc.company]
		]
	}
}

frappe.provide("erpnext.buying");

frappe.ui.form.on("Purchase Receipt", "is_subcontracted", function(frm) {
	if (frm.doc.is_subcontracted === "Yes") {
		erpnext.buying.get_default_bom(frm);
	}
	frm.toggle_reqd("supplier_warehouse", frm.doc.is_subcontracted==="Yes");
});

frappe.ui.form.on('Purchase Receipt Item', {

	// new code for Kroslink TASK TASK-2022-00015

	form_render:function(frm,cdt,cdn){
		var child = locals[cdt][cdn];
		if (child.item_code && frm.doc.is_subcontracted == "Yes") {
			console.log(" In side child")
			frappe.call({
				method: 'on_challan_number',
				doc : frm.doc,	
				args :{
					item_code : child.item_code
				},
					callback: (r) => {
						var i = 0;
						var b=[];
						// console.log(" THIS IS DATA FROM SOI", r.message)
						for(i; i < r.message.length; i++) {
							b.push(r.message[i].name);
							// console.log(" THIS IS DATA FROM SOI", r.message[i], r.message[i].name)
							// frm.fields_dict.items.grid.update_docfield_property(
							// 	'challan_number_issues_by_job_worker',
							// 	'options',
							// 	[''].concat(b)
							// ); 
						}
						console.log('thi is select options, ',b)
						
						frm.fields_dict['items'].grid.get_field('challan_number_issues_by_job_worker').get_query = function(frm, cdt, cdn) {
							console.log(" IN side challan")
							return{
								filters: [
									['name', "in", b]
								]
							};
						}
					}

			});	
		}
    },

	challan_number_issues_by_job_worker: function(frm, cdt, cdn){
		var child = locals[cdt][cdn];
		// console.log(" this is child", child.item_code)
		if (child.challan_number_issues_by_job_worker){
			frappe.call({
				method: 'on_challan_date',
				doc: frm.doc,
				args:{
					item : child.challan_number_issues_by_job_worker
				},
				callback: (r) =>{
					// console.log("this is r.message", r.message,  r.message[0].due_date)
					frappe.model.set_value(cdt, cdn, "challan_date_issues_by_job_worker", r.message[0].due_date)					
				}
			})
		}
	},

	item_code: function(frm, cdt, cdn) {
		var d = locals[cdt][cdn];
		frappe.db.get_value('Item', {name: d.item_code}, 'sample_quantity', (r) => {
			frappe.model.set_value(cdt, cdn, "sample_quantity", r.sample_quantity);
			validate_sample_quantity(frm, cdt, cdn);
		});
	},
	qty: function(frm, cdt, cdn) {
		validate_sample_quantity(frm, cdt, cdn);
	},
	sample_quantity: function(frm, cdt, cdn) {
		validate_sample_quantity(frm, cdt, cdn);
	},
	batch_no: function(frm, cdt, cdn) {
		validate_sample_quantity(frm, cdt, cdn);
	},
});

cur_frm.cscript['Make Stock Entry'] = function() {
	frappe.model.open_mapped_doc({
		method: "erpnext.stock.doctype.purchase_receipt.purchase_receipt.make_stock_entry",
		frm: cur_frm,
	})['BOM', 'company', '=', doc.company]
}

var validate_sample_quantity = function(frm, cdt, cdn) {
	var d = locals[cdt][cdn];
	if (d.sample_quantity && d.qty) {
		frappe.call({
			method: 'erpnext.stock.doctype.stock_entry.stock_entry.validate_sample_quantity',
			args: {
				batch_no: d.batch_no,
				item_code: d.item_code,
				sample_quantity: d.sample_quantity,
				qty: d.qty
			},
			callback: (r) => {
				frappe.model.set_value(cdt, cdn, "sample_quantity", r.message);
			}
		});
	}
};


