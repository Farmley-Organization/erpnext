// Copyright (c) 2017, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on("Work Order", {
	setup: function(frm) {
		frm.custom_make_buttons = {
			'Stock Entry': 'Start',
			'Pick List': 'Create Pick List',
			'Job Card': 'Create Job Card'
		};

		// Set query for warehouses
		frm.set_query("wip_warehouse", function() {
			return {
				filters: {
					'company': frm.doc.company,
				}
			};
		});

		frm.set_query("source_warehouse", function() {
			return {
				filters: {
					'company': frm.doc.company,
				}
			};
		});

		frm.set_query("source_warehouse", "required_items", function() {
			return {
				filters: {
					'company': frm.doc.company,
				}
			};
		});

		frm.set_query("sales_order", function() {
			return {
				filters: {
					"status": ["not in", ["Closed", "On Hold"]]
				}
			};
		});

		frm.set_query("fg_warehouse", function() {
			return {
				filters: {
					'company': frm.doc.company,
					'is_group': 0
				}
			};
		});

		frm.set_query("scrap_warehouse", function() {
			return {
				filters: {
					'company': frm.doc.company,
					'is_group': 0
				}
			};
		});

		// Set query for BOM
		frm.set_query("bom_no", function() {
			if (frm.doc.production_item) {
				return {
					query: "erpnext.controllers.queries.bom",
					filters: {item: cstr(frm.doc.production_item)}
				};
			} else {
				frappe.msgprint(__("Please enter Production Item first"));
			}
		});

		// Set query for FG Item
		frm.set_query("production_item", function() {
			return {
				query: "erpnext.controllers.queries.item_query",
				filters:[
					['is_stock_item', '=',1]
				]
			};
		});

		// Set query for FG Item
		frm.set_query("project", function() {
			return{
				filters:[
					['Project', 'status', 'not in', 'Completed, Cancelled']
				]
			};
		});

		frm.set_query("operation", "required_items", function() {
			return {
				query: "erpnext.manufacturing.doctype.work_order.work_order.get_bom_operations",
				filters: {
					'parent': frm.doc.bom_no,
					'parenttype': 'BOM'
				}
			};
		});

		// formatter for work order operation
		frm.set_indicator_formatter('operation',
			function(doc) { return (frm.doc.qty==doc.completed_qty) ? "green" : "orange"; });
	},

	onload: function(frm) {
		frappe.call({
			method:'make_read_only',
			doc: frm.doc,
			callback: function(resp){
				if(resp.message && resp.message ===1){
					frm.set_df_property("source_warehouse", "read_only",1)
					frm.refresh_field('source_warehouse')
				}
			}
		})
		if (!frm.doc.status)
			frm.doc.status = 'Draft';

		frm.add_fetch("sales_order", "project", "project");

		if(frm.doc.__islocal) {
			frm.set_value({
				"actual_start_date": "",
				"actual_end_date": ""
			});
			erpnext.work_order.set_default_warehouse(frm);
		}
	},

	source_warehouse: function(frm) {
		let transaction_controller = new erpnext.TransactionController();
		transaction_controller.autofill_warehouse(frm.doc.required_items, "source_warehouse", frm.doc.source_warehouse);
	},

	refresh: function(frm) {
		if(frm.doc.transfer_material_against === "Work Order"){
			frm.add_custom_button(__('Add Additional Items'),function() {
				var usr = frappe.session.user
				frappe.new_doc("Additional Item", {"work_order" : frm.doc.name, "user": usr, 'date': frappe.datetime.now_date()})
			})
		}
		set_material_transfer_for_manufacturing(frm)
		erpnext.toggle_naming_series();
		erpnext.work_order.set_custom_buttons(frm);
		frm.set_intro("");

		if (frm.doc.docstatus === 0 && !frm.doc.__islocal) {
			frm.set_intro(__("Submit this Work Order for further processing."));
		}

		if (frm.doc.docstatus===1) {
			frm.trigger('show_progress_for_items');
			frm.trigger('show_progress_for_operations');
		}
		if (frm.doc.docstatus === 1
			&& frm.doc.operations && frm.doc.operations.length
			&& frm.doc.qty != frm.doc.material_transferred_for_manufacturing) {

			const not_completed = frm.doc.operations.filter(d => {
				if(d.status != 'Completed') {
					return true;
				}
			});

			if(not_completed && not_completed.length) {
				frm.add_custom_button(__('Create Job Card'), () => {
					frm.trigger("make_job_card");
				}).addClass('btn-primary');
			}
		}

		if(frm.doc.required_items && frm.doc.allow_alternative_item) {
			const has_alternative = frm.doc.required_items.find(i => i.allow_alternative_item === 1);
			if (frm.doc.docstatus == 0 && has_alternative) {
				frm.add_custom_button(__('Alternate Item'), () => {
					erpnext.utils.select_alternate_items({
						frm: frm,
						child_docname: "required_items",
						warehouse_field: "source_warehouse",
						child_doctype: "Work Order Item",
						original_item_field: "original_item",
						condition: (d) => {
							if (d.allow_alternative_item) {return true;}
						}
					});
				});
			}
		}

		if (frm.doc.status == "Completed" &&
			frm.doc.__onload.backflush_raw_materials_based_on == "Material Transferred for Manufacture") {
			frm.add_custom_button(__('Create BOM'), () => {
				frm.trigger("make_bom");
			});
		}

		// if(frm.doc.status == "Submitted" || frm.doc.status == "Not Started" || frm.doc.status == "In Process"){
            
           

        // }

	},

	make_job_card: function(frm) {
		let qty = 0;
		let operations_data = [];

		const dialog = frappe.prompt({fieldname: 'operations', fieldtype: 'Table', label: __('Operations'),
			fields: [
				{
					fieldtype:'Link',
					fieldname:'operation',
					label: __('Operation'),
					read_only:1,
					in_list_view:1
				},
				{
					fieldtype:'Link',
					fieldname:'workstation',
					label: __('Workstation'),
					read_only:1,
					in_list_view:1
				},
				{
					fieldtype:'Data',
					fieldname:'name',
					label: __('Operation Id')
				},
				{
					fieldtype:'Float',
					fieldname:'pending_qty',
					label: __('Pending Qty'),
				},
				{
					fieldtype:'Float',
					fieldname:'qty',
					label: __('Quantity to Manufacture'),
					read_only:0,
					in_list_view:1,
				},
			],
			data: operations_data,
			in_place_edit: true,
			get_data: function() {
				return operations_data;
			}
		}, function(data) {
			frappe.call({
				method: "erpnext.manufacturing.doctype.work_order.work_order.make_job_card",
				args: {
					work_order: frm.doc.name,
					operations: data.operations,
				}
			});
		}, __("Job Card"), __("Create"));

		dialog.fields_dict["operations"].grid.wrapper.find('.grid-add-row').hide();

		var pending_qty = 0;
		frm.doc.operations.forEach(data => {
			if(data.completed_qty != frm.doc.qty) {
				pending_qty = frm.doc.qty - flt(data.completed_qty);

				dialog.fields_dict.operations.df.data.push({
					'name': data.name,
					'operation': data.operation,
					'workstation': data.workstation,
					'qty': pending_qty,
					'pending_qty': pending_qty,
				});
			}
		});
		dialog.fields_dict.operations.grid.refresh();
	},

	make_bom: function(frm) {
		frappe.call({
			method: "make_bom",
			doc: frm.doc,
			callback: function(r){
				if (r.message) {
					var doc = frappe.model.sync(r.message)[0];
					frappe.set_route("Form", doc.doctype, doc.name);
				}
			}
		});
	},

	show_progress_for_items: function(frm) {
		var bars = [];
		var message = '';
		var added_min = false;

		// produced qty
		var title = __('{0} items produced', [frm.doc.produced_qty]);
		bars.push({
			'title': title,
			'width': (frm.doc.produced_qty / frm.doc.qty * 100) + '%',
			'progress_class': 'progress-bar-success'
		});
		if (bars[0].width == '0%') {
			bars[0].width = '0.5%';
			added_min = 0.5;
		}
		message = title;
		// pending qty
		if(!frm.doc.skip_transfer){
			var pending_complete = frm.doc.material_transferred_for_manufacturing - frm.doc.produced_qty;
			if(pending_complete) {
				var width = ((pending_complete / frm.doc.qty * 100) - added_min);
				title = __('{0} items in progress', [pending_complete]);
				bars.push({
					'title': title,
					'width': (width > 100 ? "99.5" : width)  + '%',
					'progress_class': 'progress-bar-warning'
				});
				message = message + '. ' + title;
			}
		}
		frm.dashboard.add_progress(__('Status'), bars, message);
	},

	show_progress_for_operations: function(frm) {
		if (frm.doc.operations && frm.doc.operations.length) {

			let progress_class = {
				"Work in Progress": "progress-bar-warning",
				"Completed": "progress-bar-success"
			};

			let bars = [];
			let message = '';
			let title = '';
			let status_wise_oprtation_data = {};
			let total_completed_qty = frm.doc.qty * frm.doc.operations.length;

			frm.doc.operations.forEach(d => {
				if (!status_wise_oprtation_data[d.status]) {
					status_wise_oprtation_data[d.status] = [d.completed_qty, d.operation];
				} else {
					status_wise_oprtation_data[d.status][0] += d.completed_qty;
					status_wise_oprtation_data[d.status][1] += ', ' + d.operation;
				}
			});

			for (let key in status_wise_oprtation_data) {
				title = __("{0} Operations: {1}", [key, status_wise_oprtation_data[key][1].bold()]);
				bars.push({
					'title': title,
					'width': status_wise_oprtation_data[key][0] / total_completed_qty * 100  + '%',
					'progress_class': progress_class[key]
				});

				message += title + '. ';
			}

			frm.dashboard.add_progress(__('Status'), bars, message);
		}
	},

	production_item: function(frm) {
		if (frm.doc.production_item) {
			frappe.call({
				method: "erpnext.manufacturing.doctype.work_order.work_order.get_item_details",
				args: {
					item: frm.doc.production_item,
					project: frm.doc.project
				},
				freeze: true,
				callback: function(r) {
					if(r.message) {
						frm.set_value('sales_order', "");
						frm.trigger('set_sales_order');
						erpnext.in_production_item_onchange = true;

						$.each(["description", "stock_uom", "project", "bom_no", "allow_alternative_item",
							"transfer_material_against", "item_name"], function(i, field) {
							frm.set_value(field, r.message[field]);
						});

						if(r.message["set_scrap_wh_mandatory"]){
							frm.toggle_reqd("scrap_warehouse", true);
						}
						erpnext.in_production_item_onchange = false;
					}
				}
			});
		}
	},

	project: function(frm) {
		if(!erpnext.in_production_item_onchange && !frm.doc.bom_no) {
			frm.trigger("production_item");
		}
	},

	bom_no: function(frm) {
		return frm.call({
			doc: frm.doc,
			method: "get_items_and_operations_from_bom",
			freeze: true,
			callback: function(r) {
				if(r.message["set_scrap_wh_mandatory"]){
					frm.toggle_reqd("scrap_warehouse", true);
				}
			}
		});
	},

	use_multi_level_bom: function(frm) {
		if(frm.doc.bom_no) {
			frm.trigger("bom_no");
		}
	},

	qty: function(frm) {
		frm.trigger('bom_no');
	},
	// before_save: function(frm){
	// 	frm.refresh_field('planned_rm_weight')
	// },
	before_submit: function(frm) {
		frm.fields_dict.required_items.grid.toggle_reqd("source_warehouse", true);
		frm.toggle_reqd("transfer_material_against",
			frm.doc.operations && frm.doc.operations.length > 0);
		frm.fields_dict.operations.grid.toggle_reqd("workstation", frm.doc.operations);
		
		frappe.call({
			"method": "get_warehouse",
			"doc": frm.doc,
			callback: function(resp){
				if(resp.message){
					console.log("massage is: ", resp.message)
					frm.set_value('source_warehouse', resp.message)
					frm.refresh_field("source_warehouse")
					var table = locals[cdt][cdn].required_items
					table.map(item => {
						item.source_warehouse = resp.message
					})
					frm.refresh_field('required_items')
				}
			}
		})
	},

	set_sales_order: function(frm) {
		if(frm.doc.production_item) {
			frappe.call({
				method: "erpnext.manufacturing.doctype.work_order.work_order.query_sales_order",
				args: { production_item: frm.doc.production_item },
				callback: function(r) {
					frm.set_query("sales_order", function() {
						erpnext.in_production_item_onchange = true;
						return {
							filters: [
								["Sales Order","name", "in", r.message]
							]
						};
					});
				}
			});
		}
	},

	additional_operating_cost: function(frm) {
		erpnext.work_order.calculate_cost(frm.doc);
		erpnext.work_order.calculate_total_cost(frm);
	},

	// actual_fg_weight: function(frm) {
	// 	frappe.call({
	// 		method: "yeild_calc",
	// 		callback: function(r) {
	// 			if(r.message) {
	// 				console.log(r.message);
	// 			}
	// 		}
	// 	});
	// },

	// actual_rm_weight: function(frm) {
	// 	frappe.call({
	// 		method: "consumption_dev",
	// 		callback: function(r) {
	// 			if(r.message) {
	// 				frm.reload_doc();
	// 			}
	// 		}
	// 	});
	// }

});

frappe.ui.form.on("Work Order Item", {
	source_warehouse: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if(!row.item_code) {
			frappe.throw(__("Please set the Item Code first"));
		} else if(row.source_warehouse) {
			frappe.call({
				"method": "erpnext.stock.utils.get_latest_stock_qty",
				args: {
					item_code: row.item_code,
					warehouse: row.source_warehouse
				},
				callback: function (r) {
					frappe.model.set_value(row.doctype, row.name,
						"available_qty_at_source_warehouse", r.message);
				}
			});
		}
	},

	item_code: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		if (row.item_code) {
			frappe.call({
				method: "erpnext.stock.doctype.item.item.get_item_details",
				args: {
					item_code: row.item_code,
					company: frm.doc.company
				},
				callback: function(r) {
					if (r.message) {
						frappe.model.set_value(cdt, cdn, {
							"required_qty": 1,
							"item_name": r.message.item_name,
							"description": r.message.description,
							"source_warehouse": r.message.default_warehouse,
							"allow_alternative_item": r.message.allow_alternative_item,
							"include_item_in_manufacturing": r.message.include_item_in_manufacturing
						});
					}
				}
			});
		}
	}

	// required_qty: function(frm, cdt, cdn) {
	// 	frappe.call({
	// 		"method": "planned_rm_cost_calc",
	// 		callback: function(r) {
	// 			if(r.message) {
	// 				console.log(r.message);
	// 			}
	// 		}
	// 	});
	// }

});

frappe.ui.form.on("Work Order Operation", {
	workstation: function(frm, cdt, cdn) {
		var d = locals[cdt][cdn];
		if (d.workstation) {
			frappe.call({
				"method": "frappe.client.get",
				args: {
					doctype: "Workstation",
					name: d.workstation
				},
				callback: function (data) {
					frappe.model.set_value(d.doctype, d.name, "hour_rate", data.message.hour_rate);
					erpnext.work_order.calculate_cost(frm.doc);
					erpnext.work_order.calculate_total_cost(frm);
				}
			});
		}
	},
	time_in_mins: function(frm, cdt, cdn) {
		erpnext.work_order.calculate_cost(frm.doc);
		erpnext.work_order.calculate_total_cost(frm);
	},
});

erpnext.work_order = {
	set_custom_buttons: function(frm) {
		var doc = frm.doc;
		if (doc.docstatus === 1) {
			if (doc.status != 'Stopped' && doc.status != 'Completed') {
				frm.add_custom_button(__('Stop'), function() {
					erpnext.work_order.stop_work_order(frm, "Stopped");
				}, __("Status"));
			} else if (doc.status == 'Stopped') {
				frm.add_custom_button(__('Re-open'), function() {
					erpnext.work_order.stop_work_order(frm, "Resumed");
				}, __("Status"));
			}
			const show_start_btn = (frm.doc.skip_transfer
				|| frm.doc.transfer_material_against == 'Job Card') ? 0 : 1;

			if (show_start_btn) {
				// if ((flt(doc.material_transferred_for_manufacturing) < flt(doc.qty))
				if ((flt(doc.transfered_rm_weight) < flt(doc.planned_rm_weight))
					&& frm.doc.status != 'Stopped') {
					frm.has_start_btn = true;
					frm.add_custom_button(__('Create Pick List'), function() {
						erpnext.work_order.create_pick_list(frm);
					});
					var start_btn = frm.add_custom_button(__('Start'), function() {
						erpnext.work_order.make_se(frm, 'Material Transfer for Manufacture');
					});
					start_btn.addClass('btn-primary');
				}
			}

			if(!frm.doc.skip_transfer){
				// If "Material Consumption is check in Manufacturing Settings, allow Material Consumption
				if ((flt(doc.produced_qty) < flt(doc.material_transferred_for_manufacturing))
				&& frm.doc.status != 'Stopped') {
					frm.has_finish_btn = true;

					if (frm.doc.__onload && frm.doc.__onload.material_consumption == 1) {
						// Only show "Material Consumption" when required_qty > consumed_qty
						var counter = 0;
						var tbl = frm.doc.required_items || [];
						var tbl_lenght = tbl.length;
						for (var i = 0, len = tbl_lenght; i < len; i++) {
							let wo_item_qty = frm.doc.required_items[i].transferred_qty || frm.doc.required_items[i].required_qty;
							if (flt(wo_item_qty) > flt(frm.doc.required_items[i].consumed_qty)) {
								counter += 1;
							}
						}
						if (counter > 0) {
							frm.add_custom_button(__('Consume Material'),function() {
								frappe.call({
									doc: frm.doc,
									method: "make_consume_material",
									callback: function(r){
										if (r.message) {
											var doc = frappe.model.sync(r.message)[0];
											frappe.set_route("Form", doc.doctype, doc.name);
										}
									}
								});
							})
						}
					}

					var finish_btn = frm.add_custom_button(__('Partial'), function() {
						erpnext.work_order.make_se(frm, 'Manufacture');
					},("Finish"));
					frm.add_custom_button(__('Partial'),function() {
						frappe.call({
							method: "erpnext.manufacturing.doctype.work_order.work_order.make_material_produce",
							args: {
							  doc_name: frm.doc.name,
							  partial: 1
							},
							callback: function(r){
								if (r.message) {
									var doc = frappe.model.sync(r.message)[0];
									frappe.set_route("Form", doc.doctype, doc.name);
								}
							}
						});
					}, __('Finish'))
					frm.add_custom_button(__('Complete'),function() {
						frappe.call({
							method: "erpnext.manufacturing.doctype.work_order.work_order.make_material_produce",
							args: {
							  doc_name: frm.doc.name,
							  partial: 0
							},
							callback: function(r){
								if (r.message) {
									var doc = frappe.model.sync(r.message)[0];
									frappe.set_route("Form", doc.doctype, doc.name);
								}
							}
						});
					}, __('Finish'))

					if(doc.material_transferred_for_manufacturing>=doc.qty) {
						// all materials transferred for manufacturing, make this primary
						finish_btn.addClass('btn-primary');
					}
				}
			} else {
				if ((flt(doc.produced_qty) < flt(doc.qty)) && frm.doc.status != 'Stopped') {
					var finish_btn = frm.add_custom_button(__('Finish'), function() {
						erpnext.work_order.make_se(frm, 'Manufacture');
					});
					finish_btn.addClass('btn-primary');
				}
			}
		}

	},
	calculate_cost: function(doc) {
		if (doc.operations){
			var op = doc.operations;
			doc.planned_operating_cost = 0.0;
			for(var i=0;i<op.length;i++) {
				var planned_operating_cost = flt(flt(op[i].hour_rate) * flt(op[i].time_in_mins) / 60, 2);
				frappe.model.set_value('Work Order Operation', op[i].name,
					"planned_operating_cost", planned_operating_cost);
				doc.planned_operating_cost += planned_operating_cost;
			}
			refresh_field('planned_operating_cost');
		}
	},

	calculate_total_cost: function(frm) {
		let variable_cost = flt(frm.doc.actual_operating_cost) || flt(frm.doc.planned_operating_cost);
		console.log(variable_cost);
		frm.set_value("total_operating_cost", (flt(frm.doc.additional_operating_cost) + variable_cost));
	},
	set_default_warehouse: function(frm) {
		if (!(frm.doc.wip_warehouse || frm.doc.fg_warehouse)) {
			frappe.call({
				method: "erpnext.manufacturing.doctype.work_order.work_order.get_default_warehouse",
				callback: function(r) {
					if (!r.exe) {
						frm.set_value("wip_warehouse", r.message.wip_warehouse);
						frm.set_value("fg_warehouse", r.message.fg_warehouse);
						frm.set_value("scrap_warehouse", r.message.scrap_warehouse);
					}
				}
			});
		}
	},

	get_max_transferable_qty: (frm, purpose) => {
		let max = 0;
		if (frm.doc.skip_transfer) {
			// max = flt(frm.doc.qty) - flt(frm.doc.produced_qty);
			max = flt(frm.doc.planned_rm_weight) - flt(frm.doc.actual_rm_weight);
		} else {
			if (purpose === 'Manufacture') {
				// max = flt(frm.doc.material_transferred_for_manufacturing) - flt(frm.doc.produced_qty);
				max = flt(frm.doc.transfered_rm_weight) - flt(frm.doc.actual_rm_weight);
			} else {
				// max = flt(frm.doc.qty) - flt(frm.doc.material_transferred_for_manufacturing);
				max = flt(frm.doc.planned_rm_weight) - flt(frm.doc.transfered_rm_weight);
			}
		}
		return flt(max, precision('qty'));
	},

	show_prompt_for_qty_input: function(frm, purpose) {
		let max = this.get_max_transferable_qty(frm, purpose);
		return new Promise((resolve, reject) => {
			frappe.prompt({
				fieldtype: 'Float',
				label: __('Qty for {0}', [purpose]),
				fieldname: 'qty',
				description: __('Max: {0}', [max]),
				default: max
			}, data => {
				max += (frm.doc.qty * (frm.doc.__onload.overproduction_percentage || 0.0)) / 100;

				if (data.qty > max) {
					frappe.msgprint(__('Quantity must not be more than {0}', [max]));
					reject();
				}
				data.purpose = purpose;
				resolve(data);
			}, __('Select Quantity'), __('Create'));
		});
	},

	make_se: function(frm, purpose) {
		this.show_prompt_for_qty_input(frm, purpose)
			.then(data => {
				return frappe.xcall('erpnext.manufacturing.doctype.work_order.work_order.make_stock_entry', {
					'work_order_id': frm.doc.name,
					'purpose': purpose,
					'qty': data.qty
				});
			}).then(stock_entry => {
				frappe.model.sync(stock_entry);
				frappe.set_route('Form', stock_entry.doctype, stock_entry.name);
			});

	},

	create_pick_list: function(frm, purpose='Material Transfer for Manufacture') {
		this.show_prompt_for_qty_input(frm, purpose)
			.then(data => {
				return frappe.xcall('erpnext.manufacturing.doctype.work_order.work_order.create_pick_list', {
					'source_name': frm.doc.name,
					'for_qty': data.qty
				});
			}).then(pick_list => {
				frappe.model.sync(pick_list);
				frappe.set_route('Form', pick_list.doctype, pick_list.name);
			});
			console.log(data);
	},

	make_consumption_se: function(frm, backflush_raw_materials_based_on) {
		if(!frm.doc.skip_transfer){
			var max = (backflush_raw_materials_based_on === "Material Transferred for Manufacture") ?
				flt(frm.doc.material_transferred_for_manufacturing) - flt(frm.doc.produced_qty) :
				flt(frm.doc.qty) - flt(frm.doc.produced_qty);
				// flt(frm.doc.qty) - flt(frm.doc.material_transferred_for_manufacturing);
		} else {
			var max = flt(frm.doc.qty) - flt(frm.doc.produced_qty);
		}

		frappe.call({
			method:"erpnext.manufacturing.doctype.work_order.work_order.make_stock_entry",
			args: {
				"work_order_id": frm.doc.name,
				"purpose": "Material Consumption for Manufacture",
				"qty": max
			},
			callback: function(r) {
				var doclist = frappe.model.sync(r.message);
				frappe.set_route("Form", doclist[0].doctype, doclist[0].name);
			}
		});
	},

	stop_work_order: function(frm, status) {
		frappe.call({
			method: "erpnext.manufacturing.doctype.work_order.work_order.stop_unstop",
			args: {
				work_order: frm.doc.name,
				status: status
			},
			callback: function(r) {
				if(r.message) {
					frm.set_value("status", r.message);
					frm.reload_doc();
				}
			}
		});
	}
};

function set_material_transfer_for_manufacturing(frm){
    frappe.call({
        method: "erpnext.manufacturing.doctype.work_order.work_order.get_se_data",
        args: {
            wo: frm.doc.name
        },
        callback: function(res){
            if(res.message){
                // console.log('res.message is: ', res.message)
                frm.doc.material_transferred_for_manufacturing = res.message
                frm.refresh_field('material_transferred_for_manufacturing')
            }
        }
    })
}
