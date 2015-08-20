/*!
 * VIZABI BUBBLE COLOR LEGEND COMPONENT
 */

(function() {

    "use strict";

    var Vizabi = this.Vizabi;
    var utils = Vizabi.utils;
    var INDICATOR = "which";

    if (!Vizabi._require('d3')) return;
    
    Vizabi.Component.extend('gapminder-colorlegend', {
        
        init: function(config, context) {
            var _this = this;
            this.template = '<div class="vzb-cl-holder"></div>';
            
            this.model_expects = [{
                name: "color",
                type: "color"
            },{
                name: "entities",
                type: "entities"
            },{
                name: "language",
                type: "language"
            }];
            
            this.needsUpdate = false;
            this.which_1 = false;
            this.scaleType_1 = false;
            
            this.model_binds = {
                "change:color": function(evt) {
                    _this.updateView();
                },
                "change:language": function(evt) {
                    _this.updateView();
                },
                "ready": function(evt) {
                    if(!_this._readyOnce) return;
                     _this.updateView();
                }   
            }
            
            //contructor is the same as any component
            this._super(config, context);
        },
        
        
        readyOnce: function() {
            var _this = this;
            this.element = d3.select(this.element);
            this.listColorsEl = this.element.append("div").attr("class", "vzb-cl-colorList");
            this.rainbowEl = this.listColorsEl.append("div").attr("class", "vzb-cl-rainbow");
            this.worldmapEl = this.listColorsEl.append("div").attr("class", "vzb-cl-worldmap");
            
            this.colorPicker = d3.svg.colorPicker();
            this.element.call(this.colorPicker);
            
            this.worldMap = d3.svg.worldMap();
            this.worldmapEl.call(this.worldMap);
            
            this.updateView();
        },
        

        
        updateView: function(){
            var _this = this;
            this.translator = this.model.language.getTFunction();
            var KEY = this.model.entities.getDimension();

            var palette = this.model.color.palette;
            
            
            var whichPalette = "_default";
            if(Object.keys(this.model.color.getPalettes()).indexOf(this.model.color[INDICATOR]) > -1) {
                whichPalette = this.model.color[INDICATOR];
            }
            
            var paletteDefault = this.model.color.getPalettes()[whichPalette];
            

            var colors = this.listColorsEl
                .selectAll(".vzb-cl-option")
                .data(utils.keys(paletteDefault), function(d){return d});

            colors.exit().remove();
            
            colors.enter().append("div").attr("class", "vzb-cl-option")
                .each(function(){
                    d3.select(this).append("div").attr("class", "vzb-cl-color-sample");
                    d3.select(this).append("div").attr("class", "vzb-cl-color-legend");
                })
                .on("mouseover", function(){
                    //disable interaction if so stated in metadata
                    if(!_this.model.color.isUserSelectable(whichPalette)) return;
                
                    var sample = d3.select(this).select(".vzb-cl-color-sample");
                    sample.style("border-width", "5px");
                    sample.style("background-color", "transparent");

                })
                .on("mouseout", function(d){
                    //disable interaction if so stated in metadata
                    if(!_this.model.color.isUserSelectable(whichPalette)) return;
                
                    var sample = d3.select(this).select(".vzb-cl-color-sample");
                    sample.style("border-width", "0px");
                    sample.style("background-color", _this.model.color.palette[d]);
                })
                .on("click", function(d){
                    //disable interaction if so stated in metadata
                    if(!_this.model.color.isUserSelectable(whichPalette)) return;
                
                    _this.colorPicker
                        .colorOld(palette[d])
                        .colorDef(paletteDefault[d])
                        .callback(function(value){_this.model.color.setColor(value, d)})
                        .show(true);
                })
            
            
            if(this.model.color.use == "indicator"){
                this.rainbowEl.classed("vzb-hidden", false)
                    .style("height", (utils.keys(paletteDefault).length * 25 + 5) + "px")
                    .style("background", "linear-gradient(" + utils.values(palette._data).join(", ") +")");
            }else{
                this.rainbowEl.classed("vzb-hidden", true);
            }
            
            //TODO: is it okay that "geo.region" is hardcoded?
            if(this.model.color[INDICATOR] == "geo.region"){
                var regions = this.worldmapEl.classed("vzb-hidden", false)
                    .select("svg").selectAll("path");
                regions.each(function(){
                    var view = d3.select(this);
                    var color = palette[view.attr("id")];
                    view.style("fill",color);
                })
                .style("opacity", 0.8)
                .on("mouseover", function(){
                    var view = d3.select(this);
                    var region = view.attr("id");
                    regions.style("opacity",0.5);
                    view.style("opacity",1);
                    
                    var filtered = _this.model.color.getFilteredItems();
                    var highlight = utils.values(filtered)
                        //returns a function over time. pick the last time-value
                        .map(function(d){return d[d.length-1]})
                        //filter so that only countries of the correct region remain 
                        .filter(function(f){return f["geo.region"]==region})
                        //fish out the "key" field, leave the rest behind
                        .map(function(d){return utils.clone(d,[KEY]) });
                    
                    _this.model.entities.setHighlighted(highlight);
                })
                .on("mouseout", function(){
                    regions.style("opacity",0.8);
                    _this.model.entities.clearHighlighted(); 
                })
                .on("click", function(d){
                    //disable interaction if so stated in metadata
                    if(!_this.model.color.isUserSelectable(whichPalette)) return;
                    var view = d3.select(this);
                    var region = view.attr("id")
                    
                    _this.colorPicker
                        .colorOld(palette[region])
                        .colorDef(paletteDefault[region])
                        .callback(function(value){_this.model.color.setColor(value, region)})
                        .show(true);
                })
                colors.classed("vzb-hidden", true);
            }else{
                this.worldmapEl.classed("vzb-hidden", true);
                colors.classed("vzb-hidden", false);
            }
            
            colors.each(function(d, index){
                d3.select(this).select(".vzb-cl-color-sample")
                    .style("background-color", palette[d])
                    .style("border", "1px solid " + palette[d]);

                if(_this.model.color.use == "indicator"){
                    var domain = _this.model.color.getScale().domain();
                    d3.select(this).select(".vzb-cl-color-legend")
                        .text(_this.model.color.tickFormatter(domain[index]))
                }else{
                    
                    d3.select(this).select(".vzb-cl-color-legend")
                        .text(_this.translator("color/" + _this.model.color[INDICATOR] + "/" + d));
                }
            });
        }
        

    });


}).call(this);