sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel"
],
    function (BaseController, JSONModel) {
        "use strict";

        return BaseController.extend("matdocs.controller.MaterialDocuments", {
            onInit: function () {
                var oViewModel = new JSONModel({
                    busy: false,
                    delay: 0,
                    oStandard: "MaterialDocument,DocumentDate,PostingDate,Material,final_quantity,StorageLocation,InventoryStockType,GoodsMovementType",
                    oSmartTableView: "",
                    variantInput: "Standard"
                });
                sessionStorage.setItem("goToLaunchpad", "X");
                this.setModel(oViewModel, "Main");

                this.getRouter().attachRouteMatched(this.getUserAuthentication, this);
            },

            onAfterRendering: function () {
                var that = this;
                sessionStorage.setItem("goToLaunchpad", "X");
                window.addEventListener("message", function (event) {
                    var data = event.data;
                    if (data.action == "goToMainPage") {
                        that.onNavBack();
                    }
                });

                if (sessionStorage.getItem("selectedTheme").indexOf("dark") !== -1) {
                    this.byId("variantInput").removeStyleClass("variantMode");
                    this.byId("variantInput").addStyleClass("variantModeBlack");
                    jQuery(".sapUiBlockLayer, .sapUiLocalBusyIndicator").css("background-color", "rgba(28,34,40,0.99)");
                }
                else {
                    this.byId("variantInput").removeStyleClass("variantModeBlack");
                    this.byId("variantInput").addStyleClass("variantMode");
                    jQuery(".sapUiBlockLayer, .sapUiLocalBusyIndicator").css("background-color", "rgba(255, 255, 255, 0.99)");
                }
            },

            onBeforeRendering: function () {
                this.onStartVariants();
            },

            onStartVariants: function () {
                var that = this,
                    oModel = this.getModel("vModel");

                oModel.read("/xTQAxUSR_VARIANTS_DD", {
                    success: function (oData) {
                        var oResults = oData.results;
                        oResults.forEach(element => {
                            if (element.v_default) {
                                that.getModel("Main").setProperty("/variantInput", element.v_name)
                                that.getModel("Main").setProperty("/selectedVariant", element.variant_id);

                                if (element.variant_id != "Main") {
                                    var visibleInFilterBar = JSON.parse(atob(element.fbar_settings));
                                    that.onUpdateFilterBar(visibleInFilterBar);

                                    var allFieldsInVariant = JSON.parse(atob(element.stable_settings));
                                    var allNames = allFieldsInVariant.map(function (obj) {
                                        return obj.name;
                                    }).join(',');

                                    // Remove a última vírgula, se necessário
                                    if (allNames.endsWith(',')) {
                                        allNames = allNames.substring(0, allNames.length - 1);
                                    }
                                    that.getModel("Main").setProperty("/oSmartTableView", allNames);
                                    that.onBuildSmartTable();
                                }
                                else {
                                    that.getModel("Main").setProperty("/oSmartTableView", that.getModel("Main").getProperty("/oStandard"));
                                    that.onBuildSmartTable();
                                }
                            }
                        });
                    },
                    error: function (oError) {

                    }
                });
            },

            onBuildSmartTable: function () {
                var oOldSmartTable = sap.ui.getCore().byId("smartFilterBar");
                if (oOldSmartTable) {
                    oOldSmartTable.destroy();
                }

                var oDestroyedSmartTable = sap.ui.getCore().byId("smartFilterBar");
                if (!oDestroyedSmartTable) {
                    var oView = this.getView();
                    var oModel = this.getModel("Main");

                    var oSmartTable = new sap.ui.comp.smarttable.SmartTable({
                        id: "smartFilterBar",
                        entitySet: "xTQAxMAT_DOCS",
                        smartFilterId: "smartFilterBarGroups",
                        tableType: "ResponsiveTable",
                        header: "{i18n>tabletitle}",
                        showRowCount: true,
                        enableAutoBinding: true,
                        initialise: function () {
                            this.onSTinitialise.bind(this);
                            var oTable = oSmartTable.getTable();

                            oTable.attachUpdateFinished(function () {
                                var oItems = oTable.getItems();

                                if (oItems.length > 0) {

                                    oItems.forEach(oItem => {
                                        if (oItem instanceof sap.m.ColumnListItem) {
                                            var oCells = oItem.getCells();

                                            for (var i = 0; i < oCells.length; i++) {
                                                var oCell = oCells[i];

                                                if (oCell instanceof sap.m.Text) {
                                                    var cellTextReceived = oCell.getText();

                                                    if (oCell.getText().indexOf("2RNM-") !== -1 || oCell.getText().indexOf("4RNM+") !== -1) {
                                                        var cellText = cellTextReceived.substring(4),
                                                            oIndicationColor = cellTextReceived.charAt(0),
                                                            oObjectStatusApproved = new sap.m.ObjectStatus({
                                                                text: cellText,
                                                                state: "Indication0" + oIndicationColor
                                                            });

                                                        oItem.removeCell(oCell);
                                                        oItem.insertCell(oObjectStatusApproved, i);
                                                    }
                                                }
                                            }
                                        }
                                    });
                                }

                            }.bind(this));
                        }.bind(this),
                        beforeRebindTable: this.onBeforeRebindTable.bind(this),
                        initiallyVisibleFields: oModel.getProperty("/oSmartTableView")
                    }).addStyleClass("sapUiSmallMarginTop");

                    var oAggregation = oView.byId("page");
                    oAggregation.setContent(oSmartTable);

                    var oToolbar = new sap.m.OverflowToolbar({
                    });
                    oSmartTable.setCustomToolbar(oToolbar);
                }
            },

            onRouteMatched: function () {
                this.getUserAuthentication();
            },

            onFBarInitialise: function (oEvent) {
                var filterGroupItems = this.byId("smartFilterBarGroups").getFilterGroupItems(),
                    activeFiltersArray = [];

                filterGroupItems.forEach(function (item) {
                    if (item.mProperties.visibleInFilterBar) {
                        var filterInfo = {
                            name: item.mProperties.name,
                            visibleInFilterBar: item.mProperties.visibleInFilterBar
                        };
                        activeFiltersArray.push(filterInfo);
                    }
                });
                this.getModel("Main").setProperty("/vStandard", activeFiltersArray);
            },

            onSTinitialise: function (oEvent) {
                var that = this,
                    oSmartTable = oEvent.getSource(),
                    oInnerTable = oSmartTable.getTable(),
                    aColumnData = [],
                    aColumns = oInnerTable.getColumns();

                aColumns.forEach(function (oColumn) {
                    var lastIndex = oColumn.sId.lastIndexOf('-');

                    if (lastIndex !== -1) {
                        var oName = oColumn.sId.substring(lastIndex + 1);
                    }
                    aColumnData.push({
                        name: oName
                    });
                });

                that.getModel("Main").setProperty("/vSmartTableStandard", aColumnData);
            },

            onBeforeRebindTable: function (oEvent) {
                var that = this,
                    oSmartTable = oEvent.getSource(),
                    oInnerTable = oSmartTable.getTable(),
                    aNewColumnData = [],
                    aColumns = oInnerTable.getColumns();

                aColumns.forEach(function (oColumn) {
                    var lastIndex = oColumn.sId.lastIndexOf('-');

                    if (lastIndex !== -1) {
                        var oName = oColumn.sId.substring(lastIndex + 1);
                    }
                    if (oColumn.getVisible())
                        aNewColumnData.push({
                            name: oName
                        });
                });

                aColumns.forEach(function (oColumn) {
                    var lastIndex = oColumn.sId.lastIndexOf('-');

                    if (lastIndex !== -1) {
                        var oName = oColumn.sId.substring(lastIndex + 1);
                    }
                    if (oName === "final_quantity") { // Verifica se é a coluna desejada
                        // oColumn.setTemplate(new sap.m.Text({ // Define o tipo da coluna como Text
                        //     text: {
                        //         path: oColumn.getSortProperty(), // Use o caminho de ordenação da coluna
                        //         type: new sap.ui.model.type.Float({
                        //             decimals: 2
                        //         }) // Use o tipo Float com duas casas decimais
                        //     }
                        // }));
                    }
                });

                var isDifferent = this.checkArrayDifference(this.getModel("Main").getProperty("/oSmartTableView"), aNewColumnData);
                if (isDifferent) {
                    var oInput = this.byId("variantInput"),
                        activeFiltersJSON = JSON.stringify(aNewColumnData),
                        activeFiltersBtoa = btoa(activeFiltersJSON);

                    this.getModel("Main").setProperty("/SmartTableBtoa", activeFiltersBtoa);
                }
            },

            checkArrayDifference: function (a, b) {
                if (a.length !== b.length) {
                    return false;
                }

                var sortedA = a.slice().sort(),
                    sortedB = b.slice().sort();

                for (var i = 0; i < sortedA.length; i++) {
                    if (sortedA[i] !== sortedB[i]) {
                        return false;
                    }
                }

                return true;
            },

            onUpdateFilterBar: function (fbSettings) {
                var filterGroupItems = this.byId("smartFilterBarGroups").getFilterGroupItems();

                this.byId("smartFilterBarGroups").clear();

                filterGroupItems.forEach(oItem => {
                    oItem.setVisibleInFilterBar(false);
                });

                fbSettings.forEach(function (savedFilter) {
                    filterGroupItems.forEach(function (filterItem) {
                        if (savedFilter.name === filterItem.getName()) {
                            filterItem.setVisibleInFilterBar(true);

                            var control = filterItem.getControl();
                            var aFilters = savedFilter.aFilters;

                            if (aFilters && aFilters.length > 0) {
                                var filter = aFilters[0];
                                if (control instanceof sap.m.Input || control instanceof sap.m.MultiInput) {
                                    control.setValue("*" + filter.oValue1 + "*");
                                }
                                else if (control instanceof sap.m.Select || control instanceof sap.m.ComboBox) {
                                    control.setSelectedKey(filter.oValue1);
                                }
                                else if (control instanceof sap.m.CheckBox) {
                                    control.setSelected(filter.oValue1 === "true" || filter.oValue1 === true);
                                }
                            }
                        }
                    });
                });

            },

            onShowVariantList: function (oEvent) {
                var that = this,
                    oModel = this.getModel("vModel");

                if (!this._oPopover) {
                    var oList = new sap.m.List();
                    oList.setModel(oModel);
                    oList.bindItems({
                        path: "/xTQAxUSR_VARIANTS_DD",
                        template: new sap.m.StandardListItem({
                            title: "{v_name}"
                        })
                    });

                    oList.setMode(sap.m.ListMode.SingleSelectMaster);

                    oList.attachUpdateFinished(function () {
                        this.getItems().forEach(function (item) {
                            item.removeStyleClass("sapMSelectListItemBaseSelected");
                        });
                        this.getItems().forEach(function (item) {

                            var oBindingContext = item.getBindingContext();
                            var variant_id = oBindingContext.getProperty("variant_id");
                            var selectedV = that.getModel("Main").getProperty("/selectedVariant");
                            if (!selectedV) {
                                if (variant_id === "Main") {
                                    item.addStyleClass("sapMSelectListItemBaseSelected");
                                }
                            }
                            else {
                                if (variant_id === selectedV) {
                                    item.addStyleClass("sapMSelectListItemBaseSelected");
                                    that.byId("variantInput").setValue(oBindingContext.getProperty("v_name"));
                                }
                            }
                        });
                    });

                    oList.attachSelectionChange(function (oEvent) {
                        this.getItems().forEach(function (item) {
                            item.removeStyleClass("sapMSelectListItemBaseSelected");
                        });

                        var oListItem = oEvent.getParameter("listItem");
                        oListItem.addStyleClass("sapMSelectListItemBaseSelected");

                        var oBindingContext = oListItem.getBindingContext(),
                            selectedVariant = oBindingContext.getProperty("variant_id");

                        that.getModel("Main").setProperty("/selectedVariant", selectedVariant);
                        that.byId("variantInput").setValue(oBindingContext.getProperty("v_name"));

                        if (selectedVariant != "Main") {
                            var oObject = that.getModel("vModel").getObject(oBindingContext.sPath),
                                filterBarAtob = atob(oObject.fbar_settings),
                                filterBarArray = JSON.parse(filterBarAtob);
                            that.onUpdateFilterBar(filterBarArray);

                            var allFieldsInVariant = JSON.parse(atob(oObject.stable_settings));
                            var allNames = allFieldsInVariant.map(function (obj) {
                                return obj.name;
                            }).join(',');

                            // Remove a última vírgula, se necessário
                            if (allNames.endsWith(',')) {
                                allNames = allNames.substring(0, allNames.length - 1);
                            }

                            that.getModel("Main").setProperty("/oSmartTableView", allNames);
                            that.onBuildSmartTable();
                        }
                        else {
                            that.onUpdateFilterBar(that.getModel("Main").getProperty("/vStandard"));
                            that.getModel("Main").setProperty("/oSmartTableView", that.getModel("Main").getProperty("/oStandard"));
                            that.onBuildSmartTable();
                        }
                        that._oPopover.close();
                    });


                    this._oPopover = new sap.m.ResponsivePopover({
                        contentWidth: "25%",
                        title: this.getView().getModel("i18n").getResourceBundle().getText("MyViews"),
                        placement: "Bottom",
                        beginButton: new sap.m.Button({
                            text: this.getView().getModel("i18n").getResourceBundle().getText("SaveAs"),
                            type: "Emphasized",
                            press: function () {
                                that.onBeforeSaveVariant();
                                this._oPopover.close();
                            }.bind(this)
                        }),
                        endButton: new sap.m.Button({
                            text: this.getView().getModel("i18n").getResourceBundle().getText("Manage"),
                            press: function () {
                                that.onManageViews();
                                this._oPopover.close();
                            }.bind(this)
                        }),
                        content: [oList]
                    });
                }

                this._oPopover.openBy(oEvent.getSource());
            },

            onManageViews: function () {
                if (!this._oManageDialog) {
                    var oModel = this.getModel("vModel");
                    var oSearchBar = new sap.m.SearchField({
                        width: "100%",
                        placeholder: this.getView().getModel("i18n").getResourceBundle().getText("Search"),
                        liveChange: function (oEvent) {

                            var sQuery = oEvent.oSource.getValue();
                            var oFilter = new sap.ui.model.Filter("v_name", sap.ui.model.FilterOperator.Contains, sQuery);
                            oTable.getBinding("items").filter([oFilter]);
                        }
                    });

                    var oTable = new sap.m.Table({
                        columns: [
                            new sap.m.Column({ header: new sap.m.Label({ text: this.getView().getModel("i18n").getResourceBundle().getText("VariantName") }) }),
                            new sap.m.Column({ header: new sap.m.Label({ text: this.getView().getModel("i18n").getResourceBundle().getText("Default") }) }),
                            new sap.m.Column({ header: new sap.m.Label({ text: this.getView().getModel("i18n").getResourceBundle().getText("CreatedAt") }) }),
                            new sap.m.Column({ header: new sap.m.Label({ text: "" }) })
                        ]
                    });
                    oTable.setModel(oModel);

                    oTable.bindItems({
                        path: "/xTQAxUSR_VARIANTS_DD",
                        template: new sap.m.ColumnListItem({
                            cells: [
                                new sap.m.Text({ text: "{v_name}" }),
                                new sap.m.CheckBox({
                                    enabled: {
                                        path: 'variant_id',
                                        formatter: function (value) {
                                            if (value == "Main")
                                                return false;
                                        }
                                    },
                                    selected: "{v_default}",
                                    select: function (oEvent) {
                                        var oCheckBox = oEvent.getSource();
                                        var oContext = oCheckBox.getBindingContext();
                                        var selectedState = oCheckBox.getSelected();

                                        var oEntry = {};
                                        oEntry.v_default = selectedState;

                                        oModel.update(oContext.sPath, oEntry, {
                                            success: function (oCreatedData) {
                                                oModel.refresh(true);
                                            },
                                            error: function (oError) {
                                            }
                                        });
                                    }
                                }),
                                new sap.m.Text({
                                    text: {
                                        path: "created_at",
                                        type: new sap.ui.model.type.Date({
                                            pattern: "dd-MM-yyyy"
                                        })
                                    }
                                }),
                                new sap.m.Button({
                                    icon: "sap-icon://decline",
                                    visible: {
                                        path: 'v_name',
                                        formatter: function (variantName) {
                                            if (variantName == "Standard") {
                                                return false;
                                            }
                                        }
                                    },
                                    press: function (oEvent) {
                                        var oCheckBox = oEvent.getSource();
                                        var oContext = oCheckBox.getBindingContext();

                                        oModel.remove(oContext.sPath, {
                                            success: function (oCreatedData) {
                                            },
                                            error: function (oError) {
                                            }
                                        });
                                    }
                                })
                            ]
                        })
                    });

                    this._oManageDialog = new sap.m.Dialog({
                        title: this.getView().getModel("i18n").getResourceBundle().getText("Manageviews"),
                        content: [oSearchBar, oTable],
                        beginButton: new sap.m.Button({
                            text: this.getView().getModel("i18n").getResourceBundle().getText("Close"),
                            press: function () {
                                this._oManageDialog.close();
                            }.bind(this)
                        })
                    });
                }
                this._oManageDialog.open();
            },

            onBeforeSaveVariant: function () {
                var that = this;
                var oVariantName = new sap.m.Input({
                    id: "inVariantName"
                });

                var oCheckBox = new sap.m.CheckBox({
                    text: this.getView().getModel("i18n").getResourceBundle().getText("SetDefault")
                });

                var oDialog = new sap.m.Dialog({
                    title: this.getView().getModel("i18n").getResourceBundle().getText("SaveView"),
                    content: [
                        new sap.ui.layout.form.SimpleForm({
                            editable: true,
                            layout: "ResponsiveGridLayout",
                            content: [
                                new sap.m.Label({
                                    text: this.getView().getModel("i18n").getResourceBundle().getText("View")
                                }),
                                oVariantName,
                                oCheckBox
                            ]
                        })
                    ],
                    buttons: [
                        new sap.m.Button({
                            text: this.getView().getModel("i18n").getResourceBundle().getText("Save"),
                            type: "Emphasized",
                            press: function () {
                                that.onSaveVariant(oVariantName.getValue(), oCheckBox.getSelected());
                                oDialog.destroy();
                            }
                        }),
                        new sap.m.Button({
                            text: this.getView().getModel("i18n").getResourceBundle().getText("Close"),
                            press: function () {
                                oDialog.close();
                                oDialog.destroy();
                            }
                        })
                    ]
                });

                oDialog.open();
            },

            onSaveVariant: function (VariantName, vDefault) {
                var that = this,
                    oModel = this.getModel("vModel"),
                    oEntry = {},
                    oFilterBarContext = [],
                    oFilterBar = this.byId("smartFilterBarGroups"),
                    filterGroupItems = oFilterBar.getFilterGroupItems(),
                    activeFiltersArray = [];

                filterGroupItems.forEach(function (item) {
                    if (item.mProperties.visibleInFilterBar) {
                        var filterInfo = {
                            name: item.mProperties.name,
                            visibleInFilterBar: item.mProperties.visibleInFilterBar
                        };
                        activeFiltersArray.push(filterInfo);
                    }
                });

                var activeFiltersJSON = JSON.stringify(activeFiltersArray),
                    activeFiltersBtoa = btoa(activeFiltersJSON);

                this.getModel("Main").setProperty("/fbarBtoa", activeFiltersBtoa);
                var oFilterAvailable = JSON.parse(atob(this.getModel("Main").getProperty("/fbarBtoa")));

                oFilterBar.getFilters().forEach(element => {
                    var aFilters = element.aFilters,
                        oMatchingFilter = oFilterAvailable.find(fs => fs.name === aFilters[0]?.sPath);

                    if (oMatchingFilter) {
                        oMatchingFilter.aFilters = aFilters.length > 0 ? aFilters : " ";

                    }
                });

                oEntry.v_name = VariantName;

                if (this.getModel("Main").getProperty("/fbarBtoa"))
                    oEntry.fbar_settings = btoa(JSON.stringify(oFilterAvailable));
                else
                    oEntry.fbar_settings = btoa(JSON.stringify(this.getModel("Main").getProperty("/vStandard")));
                if (this.getModel("Main").getProperty("/SmartTableBtoa")) {
                    oEntry.stable_settings = this.getModel("Main").getProperty("/SmartTableBtoa");
                }
                else {
                    var oTable = sap.ui.getCore().byId("smartFilterBar").getTable(),
                        aColumnData = [],
                        aColumns = oTable.getColumns()

                    aColumns.forEach(function (oColumn) {
                        var lastIndex = oColumn.sId.lastIndexOf('-');

                        if (lastIndex !== -1) {
                            var oName = oColumn.sId.substring(lastIndex + 1);
                        }
                        if (oColumn.getVisible())
                            aColumnData.push({
                                name: oName
                            });
                    });

                    oEntry.stable_settings = btoa(JSON.stringify(aColumnData));
                }
                oEntry.app_link = 'MAT_DOCS_OVW';
                oEntry.v_default = vDefault;

                oModel.create("/xTQAxUSR_VARIANTS_DD", oEntry, {
                    success: function (oCreatedData) {
                        that.getModel("Main").setProperty("/selectedVariant", oCreatedData.variant_id);
                    },
                    error: function (oError) {

                    }
                });
            },

            onFilterChange: function (oEvent) {
                var filterGroupItems = oEvent.oSource.getFilterGroupItems(),
                    activeFiltersArray = [];

                filterGroupItems.forEach(function (item) {
                    if (item.mProperties.visibleInFilterBar) {
                        var filterInfo = {
                            name: item.mProperties.name,
                            visibleInFilterBar: item.mProperties.visibleInFilterBar
                        };
                        activeFiltersArray.push(filterInfo);
                    }
                });

                var activeFiltersJSON = JSON.stringify(activeFiltersArray),
                    activeFiltersBtoa = btoa(activeFiltersJSON);
                this.getModel("Main").setProperty("/fbarBtoa", activeFiltersBtoa);

            },


        });
    });
