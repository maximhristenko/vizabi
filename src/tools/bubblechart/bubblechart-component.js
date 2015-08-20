/*!
 * VIZABI BUBBLECHART
 */

(function() {

    "use strict";

    var Vizabi = this.Vizabi;
    var utils = Vizabi.utils;

    //warn client if d3 is not defined
    if (!Vizabi._require('d3')) return;


    //BUBBLE CHART COMPONENT
    Vizabi.Component.extend('gapminder-bubblechart', {

        /**
         * Initializes the component (Bubble Chart).
         * Executed once before any template is rendered.
         * @param {Object} config The options passed to the component
         * @param {Object} context The component's parent
         */
        init: function(context, options) {
            var _this = this;
            this.name = 'bubblechart';
            this.template = 'src/tools/bubblechart/bubblechart.html';

            //define expected models for this component
            this.model_expects = [{
                name: "time",
                type: "time"
            }, {
                name: "entities",
                type: "entities"
            }, {
                name: "marker",
                type: "model"
            }, {
                name: "language",
                type: "language"
            }];

            this.model_binds = {
                "change:time:trails": function(evt) {
                    //console.log("EVENT change:time:trails");
                    _this._trails.toggle(_this.model.time.trails);
                    _this.redrawDataPoints();
                },
                "change:time:lockNonSelected": function(evt) {
                    //console.log("EVENT change:time:lockNonSelected");
                    _this.redrawDataPoints(500);
                },
                "change:entities:show": function(evt) {
                    //console.log("EVENT change:entities:show");
                    _this.entitiesUpdatedRecently = true;
                },
                "change:marker": function(evt) {
                    // bubble size change is processed separately
                    if (!_this._readyOnce) return;
                    if (evt == "change:marker:size:max") return;
                    if (evt.indexOf("change:marker:color:palette") > -1) return;
                    //console.log("EVENT change:marker", evt);
                    _this.markersUpdatedRecently = true;
                },
                "change:entities:select": function() {
                    if (!_this._readyOnce) return;
                    //console.log("EVENT change:entities:select");
                    _this.selectDataPoints();
                    _this.redrawDataPoints();
                    _this._trails.run(["resize", "recolor", "findVisible", "reveal"]);
                    _this.updateBubbleOpacity();
                },
                "change:entities:brush": function() {
                    if (!_this._readyOnce) return;
                    //console.log("EVENT change:entities:brush");
                    _this.highlightDataPoints();
                },
                "readyOnce": function(evt) {

                },
                "ready": function(evt) {
                    if (!_this._readyOnce) return;
                    //TODO a workaround to fix the selection of entities
                    if (_this.entitiesUpdatedRecently) {
                        _this.entitiesUpdatedRecently = false;
                        //console.log("EVENT ready");
                        _this.updateEntities();
                        _this.redrawDataPoints();
                        _this.updateBubbleOpacity();
                    }
                    
                    if (_this.markersUpdatedRecently) {
                        _this.markersUpdatedRecently = false;
                        
                        _this.updateUIStrings();
                        _this.updateIndicators();
                        _this.updateSize();
                        _this.updateMarkerSizeLimits();

                        _this._trails.create();
                        _this._trails.run("findVisible");
                        _this.resetZoomer(); //does also redraw data points and trails resize
                        //_this.redrawDataPoints();
                        _this._trails.run(["recolor", "reveal"]);
                    }
                },
                'change:time:value': function() {
                    //console.log("EVENT change:time:value");
                    _this.updateTime();

                    _this._trails.run("findVisible");
                    if (_this.model.time.adaptMinMaxZoom) {
                        _this.adaptMinMaxZoom();
                    } else {
                        _this.redrawDataPoints();
                    }
                    _this._trails.run("reveal");
                },
                'change:time:adaptMinMaxZoom': function() {
                    //console.log("EVENT change:time:adaptMinMaxZoom");
                    if (_this.model.time.adaptMinMaxZoom) {
                        _this.adaptMinMaxZoom();
                    } else {
                        _this.resetZoomer();
                    }
                },
                'change:marker:size:max': function() {
                    //console.log("EVENT change:marker:size:max");
                    _this.updateMarkerSizeLimits();
                    _this._trails.run("findVisible");
                    _this.redrawDataPointsOnlySize();
                    _this._trails.run("resize");
                },
                'change:marker:color:palette': function() {
                    //console.log("EVENT change:marker:color:palette");
                    _this.redrawDataPointsOnlyColors();
                    _this._trails.run("recolor");
                },
                'change:entities:opacitySelectDim': function() {
                    _this.updateBubbleOpacity();
                },
                'change:entities:opacityRegular': function() {
                    _this.updateBubbleOpacity();
                }
            }

            this._super(context, options);

            this.xScale = null;
            this.yScale = null;
            this.sScale = null;
            this.cScale = null;

            this.xAxis = d3.svg.axisSmart();
            this.yAxis = d3.svg.axisSmart();


            this.cached = {};
            this.xyMaxMinMean = {};
            this.currentZoomFrameXY = null;

            // default UI settings
            this.ui = utils.extend({
                whenHovering: {},
                labels: {}
            }, this.ui["vzb-tool-" + this.name]);

            this.ui.whenHovering = utils.extend({
                showProjectionLineX: true,
                showProjectionLineY: true,
                higlightValueX: true,
                higlightValueY: true
            }, this.ui.whenHovering);

            this.ui.labels = utils.extend({
                autoResolveCollisions: false,
                dragging: true
            }, this.ui.labels);


            var Trail = Vizabi.Helper.get("gapminder-bublechart-trails");
            this._trails = new Trail(this);


            //            this.collisionResolver = d3.svg.collisionResolver()
            //                .value("labelY2")
            //                .fixed("labelFixed")
            //                .selector("text")
            //                .scale(this.yScale)
            //                .handleResult(this._repositionLabels);


            this.dragger = d3.behavior.drag()
                .on("dragstart", function(d, i) {
                    d3.event.sourceEvent.stopPropagation();
                })
                .on("drag", function(d, i) {
                    var KEY = _this.KEY;
                    if (!_this.ui.labels.dragging) return;
                    var cache = _this.cached[d[KEY]];
                    cache.labelFixed = true;

                    cache.labelX_ += d3.event.dx / _this.width;
                    cache.labelY_ += d3.event.dy / _this.height;

                    var resolvedX = _this.xScale(cache.labelX0) + cache.labelX_ * _this.width;
                    var resolvedY = _this.yScale(cache.labelY0) + cache.labelY_ * _this.height;
                    var resolvedX0 = _this.xScale(cache.labelX0);
                    var resolvedY0 = _this.yScale(cache.labelY0);

                    _this._repositionLabels(d, i, this, resolvedX, resolvedY, resolvedX0, resolvedY0, 0);
                })
                .on("dragend", function(d, i) {
                    var KEY = _this.KEY;
                    _this.model.entities.setLabelOffset(d, [
                        Math.round(_this.cached[d[KEY]].labelX_ * 100) / 100,
                        Math.round(_this.cached[d[KEY]].labelY_ * 100) / 100
                    ]);
                });



            this.dragRectangle = d3.behavior.drag()
                .on("dragstart", function(d, i) {
                    if (!(d3.event.sourceEvent.ctrlKey || d3.event.sourceEvent.metaKey)) return;

                    this.ctrlKeyLock = true;
                    this.origin = {
                        x: d3.mouse(this)[0] - _this.activeProfile.margin.left,
                        y: d3.mouse(this)[1] - _this.activeProfile.margin.top
                    };
                    _this.zoomRect.classed("vzb-invisible", false);
                })
                .on("drag", function(d, i) {
                    if (!this.ctrlKeyLock) return;
                    var origin = this.origin;
                    var mouse = {
                        x: d3.event.x - _this.activeProfile.margin.left,
                        y: d3.event.y - _this.activeProfile.margin.top
                    };

                    _this.zoomRect
                        .attr("x", Math.min(mouse.x, origin.x))
                        .attr("y", Math.min(mouse.y, origin.y))
                        .attr("width", Math.abs(mouse.x - origin.x))
                        .attr("height", Math.abs(mouse.y - origin.y));
                })

            .on("dragend", function(e) {
                if (!this.ctrlKeyLock) return;
                this.ctrlKeyLock = false;

                _this.zoomRect
                    .attr("width", 0)
                    .attr("height", 0)
                    .classed("vzb-invisible", true);

                this.target = {
                    x: d3.mouse(this)[0] - _this.activeProfile.margin.left,
                    y: d3.mouse(this)[1] - _this.activeProfile.margin.top
                };

                _this._zoomOnRectangle(d3.select(this), this.origin.x, this.origin.y, this.target.x, this.target.y, true, 500);
            });

            this.zoomer = d3.behavior.zoom()
                .scaleExtent([1, 100])
                .on("zoom", function() {
                    if (d3.event.sourceEvent != null && (d3.event.sourceEvent.ctrlKey || d3.event.sourceEvent.metaKey)) return;

                    var zoom = d3.event.scale;
                    var pan = d3.event.translate;
                    var ratioY = _this.zoomer.ratioY;
                    var ratioX = _this.zoomer.ratioX;


                    //value protections and fallbacks
                    if (isNaN(zoom) || zoom == null) zoom = _this.zoomer.scale();
                    if (isNaN(zoom) || zoom == null) zoom = 1;
                    if (isNaN(pan[0]) || isNaN(pan[1]) || pan[0] == null || pan[1] == null) pan = _this.zoomer.translate();
                    if (isNaN(pan[0]) || isNaN(pan[1]) || pan[0] == null || pan[1] == null) pan = [0, 0];


                    // limit the zooming, so that it never goes below 1 for any of the axes
                    if (zoom * ratioY < 1) {
                        ratioY = 1 / zoom;
                        _this.zoomer.ratioY = ratioY
                    };
                    if (zoom * ratioX < 1) {
                        ratioX = 1 / zoom;
                        _this.zoomer.ratioX = ratioX
                    };

                    //limit the panning, so that we are never outside the possible range
                    if (pan[0] > 0) pan[0] = 0;
                    if (pan[1] > 0) pan[1] = 0;
                    if (pan[0] < (1 - zoom * ratioX) * _this.width) pan[0] = (1 - zoom * ratioX) * _this.width;
                    if (pan[1] < (1 - zoom * ratioY) * _this.height) pan[1] = (1 - zoom * ratioY) * _this.height;
                    _this.zoomer.translate(pan);

                    _this.xScale.range([0 * zoom * ratioX + pan[0], _this.width * zoom * ratioX + pan[0]]);
                    _this.yScale.range([_this.height * zoom * ratioY + pan[1], 0 * zoom * ratioY + pan[1]]);

                    // Keep the min and max size (pixels) constant, when zooming.            
                    //                    _this.sScale.range([utils.radiusToArea(_this.minRadius) * zoom * zoom * ratioY * ratioX,
                    //                                        utils.radiusToArea(_this.maxRadius) * zoom * zoom * ratioY * ratioX ]);

                    var optionsY = _this.yAxis.labelerOptions();
                    var optionsX = _this.xAxis.labelerOptions();
                    optionsY.limitMaxTickNumber = zoom * ratioY < 2 ? 7 : 14;
                    optionsY.transitionDuration = _this.zoomer.duration;
                    optionsX.transitionDuration = _this.zoomer.duration;

                    _this.xAxisEl.call(_this.xAxis.labelerOptions(optionsX));
                    _this.yAxisEl.call(_this.yAxis.labelerOptions(optionsY));
                    _this.redrawDataPoints(_this.zoomer.duration);
                    _this._trails.run("resize", null, _this.zoomer.duration);

                    _this.zoomer.duration = 0;
                });

            this.zoomer.ratioX = 1;
            this.zoomer.ratioY = 1;
        },


        /**
         * Executes right after the template is in place, but the model is not yet ready
         */
        readyOnce: function() {
            var _this = this;
            this.element = d3.select(this.element);

            // reference elements
            this.graph = this.element.select('.vzb-bc-graph');
            this.yAxisElContainer = this.graph.select('.vzb-bc-axis-y');
            this.yAxisEl = this.yAxisElContainer.select('g');

            this.xAxisElContainer = this.graph.select('.vzb-bc-axis-x');
            this.xAxisEl = this.xAxisElContainer.select('g');

            this.yTitleEl = this.graph.select('.vzb-bc-axis-y-title');
            this.xTitleEl = this.graph.select('.vzb-bc-axis-x-title');
            this.sTitleEl = this.graph.select('.vzb-bc-axis-s-title');
            this.cTitleEl = this.graph.select('.vzb-bc-axis-c-title');
            this.yearEl = this.graph.select('.vzb-bc-year');

            this.projectionX = this.graph.select(".vzb-bc-projection-x");
            this.projectionY = this.graph.select(".vzb-bc-projection-y");

            this.trailsContainer = this.graph.select('.vzb-bc-trails');
            this.bubbleContainerCrop = this.graph.select('.vzb-bc-bubbles-crop');
            this.bubbleContainer = this.graph.select('.vzb-bc-bubbles');
            this.labelsContainer = this.graph.select('.vzb-bc-labels');
            this.zoomRect = this.element.select('.vzb-bc-zoomRect');

            this.entityBubbles = null;
            this.entityLabels = null;
            this.tooltip = this.element.select('.vzb-tooltip');

            //component events
            this.on("resize", function() {
                //console.log("EVENT: resize");
                _this.updateSize();
                _this.updateMarkerSizeLimits();
                _this._trails.run("findVisible");
                _this.resetZoomer(); // includes redraw data points and trail resize
            })

            //keyboard listeners
            d3.select("body")
                .on("keydown", function() {
                    if (d3.event.metaKey || d3.event.ctrlKey) _this.element.select("svg").classed("vzb-zoomin", true);
                })
                .on("keyup", function() {
                    if (!d3.event.metaKey && !d3.event.ctrlKey) _this.element.select("svg").classed("vzb-zoomin", false);
                })

            this.element
                .call(this.zoomer)
                .call(this.dragRectangle);

            this.KEY = this.model.entities.getDimension();
            this.TIMEDIM = this.model.time.getDimension();

            //console.log("EVENT ready once");
            _this.updateUIStrings();
            _this.updateIndicators();
            _this.updateEntities();
            _this.updateTime();
            _this.updateSize();
            _this.updateMarkerSizeLimits();
            _this.selectDataPoints();
            _this.updateBubbleOpacity();
            _this._trails.create();

            _this.resetZoomer(); // includes redraw data points and trail resize
            _this._trails.run(["recolor", "findVisible", "reveal"]);
            if (_this.model.time.adaptMinMaxZoom) _this.adaptMinMaxZoom();
        },




        /*
         * UPDATE INDICATORS
         */
        updateIndicators: function() {
            var _this = this;

            //scales
            this.yScale = this.model.marker.axis_y.getScale();
            this.xScale = this.model.marker.axis_x.getScale();
            this.sScale = this.model.marker.size.getScale();
            this.cScale = this.model.marker.color.getScale();

            //            this.collisionResolver.scale(this.yScale);


            this.yAxis.tickFormat(_this.model.marker.axis_y.tickFormatter);
            this.xAxis.tickFormat(_this.model.marker.axis_x.tickFormatter);

            this.xyMaxMinMean = {
                x: this.model.marker.axis_x.getMaxMinMean(this.timeFormatter),
                y: this.model.marker.axis_y.getMaxMinMean(this.timeFormatter),
                s: this.model.marker.size.getMaxMinMean(this.timeFormatter)
            };
        },


        updateUIStrings: function() {
            var _this = this;

            this.translator = this.model.language.getTFunction();
            this.timeFormatter = d3.time.format(_this.model.time.formatOutput);

            var titleStringY = this.translator("indicator/" + this.model.marker.axis_y.which);
            var titleStringX = this.translator("indicator/" + this.model.marker.axis_x.which);
            var titleStringS = this.translator("indicator/" + this.model.marker.size.which);
            var titleStringC = this.translator("indicator/" + this.model.marker.color.which);

            if (!!this.model.marker.axis_y.unit) titleStringY = titleStringY + ", " + this.model.marker.axis_y.unit;
            if (!!this.model.marker.axis_x.unit) titleStringX = titleStringX + ", " + this.model.marker.axis_x.unit;
            if (!!this.model.marker.size.unit) titleStringS = titleStringS + ", " + this.model.marker.size.unit;
            if (!!this.model.marker.color.unit) titleStringC = titleStringC + ", " + this.model.marker.color.unit;

            var yTitle = this.yTitleEl.selectAll("text").data([0]);
            yTitle.enter().append("text");
            yTitle
                .attr("y", "-6px")
                .attr("x", "-9px")
                .attr("dx", "-0.72em")
                .text(titleStringY);

            var xTitle = this.xTitleEl.selectAll("text").data([0]);
            xTitle.enter().append("text");
            xTitle
                .attr("text-anchor", "end")
                .attr("y", "-0.32em")
                .text(titleStringX);

            var sTitle = this.sTitleEl.selectAll("text").data([0]);
            sTitle.enter().append("text");
            sTitle
                .attr("text-anchor", "end")
                .text(this.translator("buttons/size") + ": " + titleStringS + ", " +
                    this.translator("buttons/colors") + ": " + titleStringC);

        },

        /*
         * UPDATE ENTITIES:
         * Ideally should only update when show parameters change or data changes
         */
        updateEntities: function() {
            var _this = this;
            var KEY = this.KEY;
            var TIMEDIM = this.TIMEDIM;

            // get array of GEOs, sorted by the size hook
            // that makes larger bubbles go behind the smaller ones
            var endTime = this.model.time.end;
            this.model.entities._visible = this.model.marker.label.getItems()
                .map(function(d) {
                    var pointer = {};
                    pointer[KEY] = d[KEY];
                    pointer[TIMEDIM] = endTime;
                    pointer.sortValue = _this.model.marker.size.getValue(pointer);
                    return pointer;
                })
                .sort(function(a, b) {
                    return b.sortValue - a.sortValue;
                });

            this.entityBubbles = this.bubbleContainer.selectAll('.vzb-bc-entity')
                .data(this.model.entities._visible, function(d) {
                    return d[KEY]
                });

            //exit selection
            this.entityBubbles.exit().remove();

            //enter selection -- init circles
            this.entityBubbles.enter().append("circle")
                .attr("class", "vzb-bc-entity")
                .on("mousemove", function(d, i) {

                    _this.model.entities.highlightEntity(d);

                    var text = "";
                    if (_this.model.entities.isSelected(d) && _this.model.time.trails) {
                        text = _this.timeFormatter(_this.time);
                        _this.entityLabels
                            .filter(function(f) {return f[KEY] == d[KEY]})
                            .classed("vzb-highlighted", true);
                    } else {
                        text = _this.model.marker.label.getValue(d);
                    }
                    _this._setTooltip(text);
                })
                .on("mouseout", function(d, i) {

                    _this.model.entities.clearHighlighted();
                    _this._setTooltip();
                    _this.entityLabels.classed("vzb-highlighted", false);
                })
                .on("click", function(d, i) {

                    _this.model.entities.selectEntity(d, this.TIMEDIM, _this.timeFormatter);
                });




            //TODO: no need to create trail group for all entities
            //TODO: instead of :append an :insert should be used to keep order, thus only few trail groups can be inserted
            this.entityTrails = this.trailsContainer.selectAll(".vzb-bc-entity")
                .data(this.model.entities._visible, function(d) {
                    return d[KEY]
                });

            this.entityTrails.exit().remove();

            this.entityTrails.enter().append("g")
                .attr("class", function(d) {
                    return "vzb-bc-entity" + " " + d[KEY]
                });

        },

        adaptMinMaxZoom: function() {
            var _this = this;
            var mmmX = _this.xyMaxMinMean.x[_this.timeFormatter(_this.time)];
            var mmmY = _this.xyMaxMinMean.y[_this.timeFormatter(_this.time)];
            var radiusMax = utils.areaToRadius(_this.sScale(_this.xyMaxMinMean.s[_this.timeFormatter(_this.time)].max));
            var frame = _this.currentZoomFrameXY;

            var suggestedFrame = {
                x1: _this.xScale(mmmX.min) - radiusMax,
                y1: _this.yScale(mmmY.min) + radiusMax,
                x2: _this.xScale(mmmX.max) + radiusMax,
                y2: _this.yScale(mmmY.max) - radiusMax,
            }

            var TOLERANCE = 0.3;

            if (!frame || suggestedFrame.x1 < frame.x1 * (1 - TOLERANCE) || suggestedFrame.x2 > frame.x2 * (1 + TOLERANCE) || suggestedFrame.y2 < frame.y2 * (1 - TOLERANCE) || suggestedFrame.y1 > frame.y1 * (1 + TOLERANCE)) {
                _this.currentZoomFrameXY = utils.clone(suggestedFrame);
                var frame = _this.currentZoomFrameXY;
                _this._zoomOnRectangle(_this.element, frame.x1, frame.y1, frame.x2, frame.y2, false, _this.duration);
                //console.log("rezoom")
            } else {
                _this.redrawDataPoints(_this.duration);
                //console.log("no rezoom")
            }
        },

        _zoomOnRectangle: function(element, x1, y1, x2, y2, compensateDragging, duration) {
            var _this = this;
            var zoomer = _this.zoomer;

            if (Math.abs(x1 - x2) < 10 || Math.abs(y1 - y2) < 10) return;


            if (Math.abs(x1 - x2) > Math.abs(y1 - y2)) {
                var zoom = _this.height / Math.abs(y1 - y2) * zoomer.scale();
                var ratioX = _this.width / Math.abs(x1 - x2) * zoomer.scale() / zoom * zoomer.ratioX;
                var ratioY = zoomer.ratioY;
            } else {
                var zoom = _this.width / Math.abs(x1 - x2) * zoomer.scale();
                var ratioY = _this.height / Math.abs(y1 - y2) * zoomer.scale() / zoom * zoomer.ratioY;
                var ratioX = zoomer.ratioX;
            }

            if (compensateDragging) {
                zoomer.translate([
                    zoomer.translate()[0] + x1 - x2,
                    zoomer.translate()[1] + y1 - y2
                ])
            }

            var pan = [
                (zoomer.translate()[0] - Math.min(x1, x2)) / zoomer.scale() / zoomer.ratioX * zoom * ratioX, (zoomer.translate()[1] - Math.min(y1, y2)) / zoomer.scale() / zoomer.ratioY * zoom * ratioY
            ]

            zoomer.scale(zoom);
            zoomer.ratioY = ratioY;
            zoomer.ratioX = ratioX;
            zoomer.translate(pan);
            zoomer.duration = duration ? duration : 0;

            zoomer.event(element);
        },

        resetZoomer: function(element) {
            this.zoomer.scale(1);
            this.zoomer.ratioY = 1;
            this.zoomer.ratioX = 1;
            this.zoomer.translate([0, 0]);
            this.zoomer.duration = 0;
            this.zoomer.event(element || this.element);
        },

        /*
         * UPDATE TIME:
         * Ideally should only update when time or data changes
         */
        updateTime: function() {
            var _this = this;

            this.time_1 = this.time == null ? this.model.time.value : this.time;
            this.time = this.model.time.value;
            this.duration = this.model.time.playing && (this.time - this.time_1 > 0) ? this.model.time.speed : 0;

            this.yearEl.text(this.timeFormatter(this.time));
        },

        /*
         * RESIZE:
         * Executed whenever the container is resized
         */
        updateSize: function() {

            var _this = this;


            this.profiles = {
                "small": {
                    margin: {
                        top: 30,
                        right: 20,
                        left: 40,
                        bottom: 40
                    },
                    padding: 2,
                    minRadius: 2,
                    maxRadius: 40
                },
                "medium": {
                    margin: {
                        top: 30,
                        right: 60,
                        left: 60,
                        bottom: 40
                    },
                    padding: 2,
                    minRadius: 3,
                    maxRadius: 60
                },
                "large": {
                    margin: {
                        top: 30,
                        right: 60,
                        left: 60,
                        bottom: 40
                    },
                    padding: 2,
                    minRadius: 4,
                    maxRadius: 80
                }
            };

            this.activeProfile = this.profiles[this.getLayoutProfile()];
            var margin = this.activeProfile.margin;


            //stage
            this.height = parseInt(this.element.style("height"), 10) - margin.top - margin.bottom;
            this.width = parseInt(this.element.style("width"), 10) - margin.left - margin.right;

            //            this.collisionResolver.height(this.height);

            //graph group is shifted according to margins (while svg element is at 100 by 100%)
            this.graph
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


            this.yearEl
                .attr("x", this.width / 2)
                .attr("y", this.height / 3 * 2)
                .style("font-size", Math.max(this.height / 4, this.width / 4) + "px");

            //update scales to the new range
            if (this.model.marker.axis_y.scaleType !== "ordinal") {
                this.yScale.range([this.height, 0]);
            } else {
                this.yScale.rangePoints([this.height, 0], _this.activeProfile.padding).range();
            }
            if (this.model.marker.axis_x.scaleType !== "ordinal") {
                this.xScale.range([0, this.width]);
            } else {
                this.xScale.rangePoints([0, this.width], _this.activeProfile.padding).range();
            }

            //apply scales to axes and redraw
            this.yAxis.scale(this.yScale)
                .orient("left")
                .tickSize(6, 0)
                .tickSizeMinor(3, 0)
                .labelerOptions({
                    scaleType: this.model.marker.axis_y.scaleType,
                    toolMargin: margin,
                    limitMaxTickNumber: 6
                });

            this.xAxis.scale(this.xScale)
                .orient("bottom")
                .tickSize(6, 0)
                .tickSizeMinor(3, 0)
                .labelerOptions({
                    scaleType: this.model.marker.axis_x.scaleType,
                    toolMargin: margin
                });


            this.bubbleContainerCrop
                .attr("width", this.width)
                .attr("height", this.height);

            this.xAxisElContainer
                .attr("width", this.width)
                .attr("height", this.activeProfile.margin.bottom)
                .attr("y", this.height);
            this.xAxisEl
                .attr("transform", "translate(0," + 1 + ")");

            this.yAxisElContainer
                .attr("width", this.activeProfile.margin.left)
                .attr("height", this.height)
                .attr("x", -this.activeProfile.margin.left);
            this.yAxisEl
                .attr("transform", "translate(" + (this.activeProfile.margin.left - 1) + "," + 0 + ")");

            this.xTitleEl.attr("transform", "translate(" + this.width + "," + this.height + ")");
            this.sTitleEl.attr("transform", "translate(" + this.width + "," + 0 + ") rotate(-90)");

            this.yAxisEl.call(this.yAxis);
            this.xAxisEl.call(this.xAxis);

            this.projectionX.attr("y1", _this.yScale.range()[0]);
            this.projectionY.attr("x2", _this.xScale.range()[0]);

        },

        updateMarkerSizeLimits: function() {
            var _this = this;
            var minRadius = this.activeProfile.minRadius;
            var maxRadius = this.activeProfile.maxRadius;

            this.minRadius = Math.max(maxRadius * this.model.marker.size.min, minRadius);
            this.maxRadius = maxRadius * this.model.marker.size.max;

            if (this.model.marker.size.scaleType !== "ordinal") {
                this.sScale.range([utils.radiusToArea(_this.minRadius), utils.radiusToArea(_this.maxRadius)]);
            } else {
                this.sScale.rangePoints([utils.radiusToArea(_this.minRadius), utils.radiusToArea(_this.maxRadius)], 0).range();
            }

        },

        redrawDataPointsOnlyColors: function() {
            var _this = this;
            var KEY = this.KEY;
            var TIMEDIM = this.TIMEDIM;

            this.entityBubbles.style("fill", function(d) {
                var pointer = {};
                pointer[KEY] = d[KEY];
                pointer[TIMEDIM] = _this.time;
                
                var valueC = _this.model.marker.color.getValue(pointer);
                return _this.cScale(valueC);
            });
        },

        redrawDataPointsOnlySize: function() {
            var _this = this;

            if (this.someSelected) {
                _this.entityBubbles.each(function(d, index) {
                    _this._updateBubble(d, index, d3.select(this), 0);
                });
            } else {
                this.entityBubbles.each(function(d, index) {
                    var valueS = _this.model.marker.size.getValue(d);
                    if (valueS == null) return;

                    d3.select(this).attr("r", utils.areaToRadius(_this.sScale(valueS)));
                });
            }
        },

        /*
         * REDRAW DATA POINTS:
         * Here plotting happens
         */
        redrawDataPoints: function(duration) {
            var _this = this;

            if (duration == null) duration = _this.duration;

            this.entityBubbles.each(function(d, index) {
                var view = d3.select(this);
                _this._updateBubble(d, index, view, duration);

            }); // each bubble

            // Call flush() after any zero-duration transitions to synchronously flush the timer queue
            // and thus make transition instantaneous. See https://github.com/mbostock/d3/issues/1951
            if (_this.duration == 0) d3.timer.flush();

            if (_this.ui.labels.autoResolveCollisions) {
                // cancel previously queued simulation if we just ordered a new one
                clearTimeout(_this.collisionTimeout);

                // place label layout simulation into a queue
                _this.collisionTimeout = setTimeout(function() {
                    //  _this.entityLabels.call(_this.collisionResolver.data(_this.cached));
                }, _this.model.time.speed * 1.2)
            }

        },

        //redraw Data Points
        _updateBubble: function(d, index, view, duration) {
            var _this = this;
            var TIMEDIM = this.TIMEDIM;

            if (_this.model.time.lockNonSelected && _this.someSelected && !_this.model.entities.isSelected(d)) {
                d[TIMEDIM] = _this.timeFormatter.parse("" + _this.model.time.lockNonSelected);
            } else {
                d[TIMEDIM] = _this.time;
            };

            var valueY = _this.model.marker.axis_y.getValue(d);
            var valueX = _this.model.marker.axis_x.getValue(d);
            var valueS = _this.model.marker.size.getValue(d);
            var valueL = _this.model.marker.label.getValue(d);
            var valueC = _this.model.marker.color.getValue(d);

            // check if fetching data succeeded
            //TODO: what if values are ACTUALLY 0 ?
            if (!valueL || !valueY || !valueX || !valueS) {
                // if entity is missing data it should hide
                view.classed("vzb-invisible", true)

            } else {

                // if entity has all the data we update the visuals
                var scaledS = utils.areaToRadius(_this.sScale(valueS));

                view.classed("vzb-invisible", false)
                    .style("fill", _this.cScale(valueC))
                    .transition().duration(duration).ease("linear")
                    .attr("cy", _this.yScale(valueY))
                    .attr("cx", _this.xScale(valueX))
                    .attr("r", scaledS)

                _this._updateLabel(d, index, valueX, valueY, scaledS, valueL, duration);

            } // data exists
        },




        _updateLabel: function(d, index, valueX, valueY, scaledS, valueL, duration) {
            var _this = this;
            var KEY = this.KEY;
            if (duration == null) duration = _this.duration;

            // only for selected entities
            if (_this.model.entities.isSelected(d) && _this.entityLabels != null) {

                if (_this.cached[d[KEY]] == null) _this.cached[d[KEY]] = {};
                var cached = _this.cached[d[KEY]];


                var select = utils.find(_this.model.entities.select, function(f) {return f[KEY] == d[KEY]});
                var trailStartTime = _this.timeFormatter.parse("" + select.trailStartTime);

                cached.valueX = valueX;
                cached.valueY = valueY;

                if (!_this.model.time.trails || trailStartTime - _this.time > 0 || select.trailStartTime == null) {

                    select.trailStartTime = _this.timeFormatter(_this.time);
                    //the events in model are not triggered here. to trigger uncomment the next line
                    //_this.model.entities.triggerAll("change:select");

                    cached.scaledS0 = scaledS;
                    cached.labelX0 = valueX;
                    cached.labelY0 = valueY;
                }

                if (cached.scaledS0 == null || cached.labelX0 == null || cached.labelX0 == null) {
                    cached.scaledS0 = scaledS;
                    cached.labelX0 = valueX;
                    cached.labelY0 = valueY;
                }


                // reposition label
                _this.entityLabels.filter(function(f) {return f[KEY] == d[KEY]})
                    .each(function(groupData) {

                        var labelGroup = d3.select(this);

                        var text = labelGroup.selectAll("text.vzb-bc-label-content")
                            .text(valueL + (_this.model.time.trails ? " " + select.trailStartTime : ""));

                        var line = labelGroup.select("line")
                            .style("stroke-dasharray", "0 " + (cached.scaledS0 + 2) + " 100%");

                        var rect = labelGroup.select("rect");

                        var contentBBox = text[0][0].getBBox();
                        if (!cached.contentBBox || cached.contentBBox.width != contentBBox.width) {
                            cached.contentBBox = contentBBox;

                            labelGroup.select("text.vzb-bc-label-x")
                                .attr("x", contentBBox.width + contentBBox.height * 0.0 + 2)
                                .attr("y", contentBBox.height * 0.0 - 4);

                            labelGroup.select("circle")
                                .attr("cx", contentBBox.width + contentBBox.height * 0.0 + 2)
                                .attr("cy", contentBBox.height * 0.0 - 4)
                                .attr("r", contentBBox.height * 0.5);

                            rect.attr("width", contentBBox.width + 4)
                                .attr("height", contentBBox.height + 4)
                                .attr("x", -2)
                                .attr("y", -4)
                                .attr("rx", contentBBox.height * 0.2)
                                .attr("ry", contentBBox.height * 0.2);
                        }

                        cached.labelX_ = select.labelOffset[0] || cached.scaledS0 / _this.width;
                        cached.labelY_ = select.labelOffset[1] || cached.scaledS0 / _this.width;

                        var resolvedX = _this.xScale(cached.labelX0) + cached.labelX_ * _this.width;
                        var resolvedY = _this.yScale(cached.labelY0) + cached.labelY_ * _this.height;

                        var limitedX = resolvedX > 0 ? (resolvedX < _this.width - cached.contentBBox.width ? resolvedX : _this.width - cached.contentBBox.width) : 0;
                        var limitedY = resolvedY > 0 ? (resolvedY < _this.height - cached.contentBBox.height ? resolvedY : _this.height - cached.contentBBox.height) : 0;

                        var limitedX0 = _this.xScale(cached.labelX0);
                        var limitedY0 = _this.yScale(cached.labelY0);

                        cached.stuckOnLimit = limitedX != resolvedX || limitedY != resolvedY;

                        rect.classed("vzb-transparent", !cached.stuckOnLimit);

                        _this._repositionLabels(d, index, this, limitedX, limitedY, limitedX0, limitedY0, duration);

                    })
            } else {
                //for non-selected bubbles
                //make sure there is no cached data
                if (_this.cached[d[KEY]] != null) {
                    delete _this.cached[d[KEY]]
                };
            }
        },

        _repositionLabels: function(d, i, context, resolvedX, resolvedY, resolvedX0, resolvedY0, duration) {

            var labelGroup = d3.select(context);

            labelGroup
                .transition().duration(duration || 0).ease("linear")
                .attr("transform", "translate(" + resolvedX + "," + resolvedY + ")");

            labelGroup.selectAll("line")
                .attr("x1", resolvedX0 - resolvedX)
                .attr("y1", resolvedY0 - resolvedY);

        },



        selectDataPoints: function() {
            var _this = this;
            var KEY = this.KEY;

            _this.someSelected = (_this.model.entities.select.length > 0);


            this.entityLabels = this.labelsContainer.selectAll('.vzb-bc-entity')
                .data(_this.model.entities.select, function(d) { return (d[KEY]);});


            this.entityLabels.exit()
                .each(function(d) {
                    _this._trails.run("remove", d);
                })
                .remove();

            this.entityLabels
                .enter().append("g")
                .attr("class", "vzb-bc-entity")
                .call(_this.dragger)
                .each(function(d, index) {
                    var view = d3.select(this);
                    view.append("line").attr("class", "vzb-bc-label-line");

                    view.append("rect").attr("class", "vzb-transparent")
                        .on("click", function(d, i) {
                            //default prevented is needed to distinguish click from drag
                            if (d3.event.defaultPrevented) return

                            var maxmin = _this.cached[d[KEY]].maxMinValues;
                            var radius = utils.areaToRadius(_this.sScale(maxmin.valueSmax));
                            _this._zoomOnRectangle(_this.element,
                                _this.xScale(maxmin.valueXmin) - radius,
                                _this.yScale(maxmin.valueYmin) + radius,
                                _this.xScale(maxmin.valueXmax) + radius,
                                _this.yScale(maxmin.valueYmax) - radius,
                                false, 500);
                        });

                    view.append("text").attr("class", "vzb-bc-label-content vzb-bc-label-shadow");

                    view.append("text").attr("class", "vzb-bc-label-content");

                    view.append("circle").attr("class", "vzb-bc-label-x vzb-bc-label-shadow vzb-transparent")
                        .on("click", function(d, i) {
                            //default prevented is needed to distinguish click from drag
                            if (d3.event.defaultPrevented) return
                            _this.model.entities.selectEntity(d);
                        });

                    view.append("text").attr("class", "vzb-bc-label-x vzb-transparent").text("x");

                    _this._trails.create(d);
                })
                .on("mousemove", function() {
                    d3.select(this).selectAll(".vzb-bc-label-x")
                        .classed("vzb-transparent", false)
                    d3.select(this).select("rect")
                        .classed("vzb-transparent", false)
                })
                .on("mouseout", function(d) {
                    d3.select(this).selectAll(".vzb-bc-label-x")
                        .classed("vzb-transparent", true)
                    d3.select(this).select("rect")
                        .classed("vzb-transparent", !_this.cached[d[KEY]].stuckOnLimit)
                });




        },




        _setTooltip: function(tooltipText) {
            if (tooltipText) {
                var mouse = d3.mouse(this.graph.node()).map(function(d) {
                    return parseInt(d)
                });

                //position tooltip
                this.tooltip.classed("vzb-hidden", false)
                    .attr("style", "left:" + (mouse[0] + 50) + "px;top:" + (mouse[1] + 50) + "px")
                    .html(tooltipText);

            } else {

                this.tooltip.classed("vzb-hidden", true);
            }
        },

        /*
         * Shows and hides axis projections
         */
        _axisProjections: function(d) {
            if (d != null) {

                var valueY = this.model.marker.axis_y.getValue(d);
                var valueX = this.model.marker.axis_x.getValue(d);
                var valueS = this.model.marker.size.getValue(d);
                var radius = utils.areaToRadius(this.sScale(valueS))
                
                if(!valueY || !valueX || !valueS) return;

                if (this.ui.whenHovering.showProjectionLineX) {
                    this.projectionX
                        .style("opacity", 1)
                        .attr("y2", this.yScale(valueY) + radius)
                        .attr("x1", this.xScale(valueX))
                        .attr("x2", this.xScale(valueX));
                }
                if (this.ui.whenHovering.showProjectionLineY) {
                    this.projectionY
                        .style("opacity", 1)
                        .attr("y1", this.yScale(valueY))
                        .attr("y2", this.yScale(valueY))
                        .attr("x1", this.xScale(valueX) - radius);
                }

                if (this.ui.whenHovering.higlightValueX) this.xAxisEl.call(
                    this.xAxis.highlightValue(valueX)
                );

                if (this.ui.whenHovering.higlightValueY) this.yAxisEl.call(
                    this.yAxis.highlightValue(valueY)
                );

            } else {

                this.projectionX.style("opacity", 0);
                this.projectionY.style("opacity", 0);
                this.xAxisEl.call(this.xAxis.highlightValue("none"));
                this.yAxisEl.call(this.yAxis.highlightValue("none"));

            }

        },

        /*
         * Highlights all hovered bubbles
         */
        highlightDataPoints: function() {
            var _this = this;
            var TIMEDIM = this.TIMEDIM;

            this.someHighlighted = (this.model.entities.brush.length > 0);

            this.updateBubbleOpacity();

            if (this.model.entities.brush.length === 1) {
                var d = utils.clone(this.model.entities.brush[0]);

                if (_this.model.time.lockNonSelected && _this.someSelected && !_this.model.entities.isSelected(d)) {
                    d[TIMEDIM] = _this.timeFormatter.parse("" + _this.model.time.lockNonSelected);
                } else {
                    d[TIMEDIM] = _this.time;
                }

                this._axisProjections(d);
            } else {
                this._axisProjections();
            }
        },

        updateBubbleOpacity: function(duration) {
            var _this = this;
            //if(!duration)duration = 0;

            var OPACITY_HIGHLT = 1.0;
            var OPACITY_HIGHLT_DIM = 0.3;
            var OPACITY_SELECT = 0.8;
            var OPACITY_REGULAR = this.model.entities.opacityRegular;
            var OPACITY_SELECT_DIM = this.model.entities.opacitySelectDim;

            this.entityBubbles
                //.transition().duration(duration)
                .style("opacity", function(d) {

                    if (_this.someHighlighted) {
                        //highlight or non-highlight
                        if (_this.model.entities.isHighlighted(d)) return OPACITY_HIGHLT;
                    }

                    if (_this.someSelected) {
                        //selected or non-selected
                        return _this.model.entities.isSelected(d) ? OPACITY_SELECT : OPACITY_SELECT_DIM;
                    }

                    if (_this.someHighlighted) return OPACITY_HIGHLT_DIM;

                    return OPACITY_REGULAR;
                });


            var someSelectedAndOpacityZero = _this.someSelected && _this.model.entities.opacitySelectDim < 0.01;

            // when pointer events need update...
            if (someSelectedAndOpacityZero != this.someSelectedAndOpacityZero_1) {
                this.entityBubbles.style("pointer-events", function(d) {
                    return (!someSelectedAndOpacityZero || _this.model.entities.isSelected(d)) ?
                        "visible" : "none";
                });
            }

            this.someSelectedAndOpacityZero_1 = _this.someSelected && _this.model.entities.opacitySelectDim < 0.01;
        }



    });


}).call(this);
