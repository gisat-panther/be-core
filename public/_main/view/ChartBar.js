Ext.define('PumaMain.view.ChartBar', {
    extend: 'Ext.container.Container',
    alias: 'widget.chartbar',
    requires: ['PumaMain.view.ScreenshotView'],
    autoScroll: true,
    
    height:"100%",
    initComponent: function() {

        this.layout = {
            type: 'accordion',
            multi: true,
            fill: false
        }
        this.items = [
            {
                xtype: 'panel',
                collapsed: false,
                layout: 'fit',
                iconCls: 'cmptype-snapshot',
                collapseLeft: true,
                itemId: 'screenshotpanel',
                helpId: 'xhelp15',
                items: [{
                    xtype: 'screenshotview'
                }],
                cfgType: 'screenshots',  
                height: 400,
                title: 'Snapshots'
            },
            {
                xtype: 'panel',
                collapsed: true,
                cfgType: 'add',
                helpId: 'xhelp13',
                iconCls: 'cmptype-addchart',
                leftSpace: 25,
                hideCollapseTool: true,
                title: 'Add chart'
            }
        ]
        this.callParent();
    }
})


