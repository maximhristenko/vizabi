/*!
 * VIZABI BARCHART
 */

(function() {

    "use strict";

    var Vizabi = this.Vizabi;
    var utils = Vizabi.utils;

    //warn client if d3 is not defined
    if (!Vizabi._require('d3')) return;

    var comp_template = 'src/tools/barchart/barchart.html';

    //BAR CHART COMPONENT
    Vizabi.Component.extend('gapminder-barchart', {

        /**
         * Initializes the component (Bar Chart).
         * Executed once before any template is rendered.
         * @param {Object} config The options passed to the component
         * @param {Object} context The component's parent
         */
        init: function(config, context) {
            this.name = 'barchart';
            this.template = comp_template;

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

            var _this = this;
            this.model_binds = {
                "change:time:value": function(evt) {
                    _this.updateEntities();
                }
            };

            //contructor is the same as any component
            this._super(config, context);

            this.xScale = null;
            this.yScale = null;
            this.cScale = d3.scale.category10();

            this.xAxis = d3.svg.axisSmart();
            this.yAxis = d3.svg.axisSmart();
        },

        /**
         * DOM is ready
         */
        readyOnce: function() {

            this.element = d3.select(this.element);

            this.graph = this.element.select('.vzb-bc-graph');
            this.yAxisEl = this.graph.select('.vzb-bc-axis-y');
            this.xAxisEl = this.graph.select('.vzb-bc-axis-x');
            this.yTitleEl = this.graph.select('.vzb-bc-axis-y-title');
            this.bars = this.graph.select('.vzb-bc-bars');

            var _this = this;
            this.on("resize", function() {
                _this.updateEntities();
            });
        },

        /*
         * Both model and DOM are ready
         */
        ready: function() {
            this.updateIndicators();
            this.resize();
            this.updateEntities();
        },

        /**
         * Changes labels for indicators
         */
        updateIndicators: function() {
            var _this = this;
            this.translator = this.model.language.getTFunction();
            this.duration = this.model.time.speed;

            var titleStringY = this.translator("indicator/" + this.model.marker.axis_y.which);

            var yTitle = this.yTitleEl.selectAll("text").data([0]);
            yTitle.enter().append("text");
            yTitle
                .attr("y", "-6px")
                .attr("x", "-9px")
                .attr("dx", "-0.72em")
                .text(titleStringY);

            this.yScale = this.model.marker.axis_y.getScale();
            this.xScale = this.model.marker.axis_x.getScale();
            this.cScale = this.model.marker.color.getScale();

            this.yAxis.tickFormat(_this.model.marker.axis_y.tickFormatter);
            this.xAxis.tickFormat(_this.model.marker.axis_x.tickFormatter);
        },

        /**
         * Updates entities
         */
        updateEntities: function() {

            var _this = this;
            var time = this.model.time;
            var timeDim = time.getDimension();
            var duration = (time.playing) ? time.speed : 0;
            var filter = {};
            filter[timeDim] = time.value;
            var items = this.model.marker.label.getItems(filter);

            this.entityBars = this.bars.selectAll('.vzb-bc-bar')
                .data(items);

            //exit selection
            this.entityBars.exit().remove();

            //enter selection -- init circles
            this.entityBars.enter().append("rect")
                .attr("class", "vzb-bc-bar")
                .on("mousemove", function(d, i) {})
                .on("mouseout", function(d, i) {})
                .on("click", function(d, i) {});

            //positioning and sizes of the bars

            var bars = this.bars.selectAll('.vzb-bc-bar');
            var barWidth = this.xScale.rangeBand();

            this.bars.selectAll('.vzb-bc-bar')
                .attr("width", barWidth)
                .attr("fill", function(d) {
                    return _this.cScale(_this.model.marker.color.getValue(d));
                })
                .attr("x", function(d) {
                    return _this.xScale(_this.model.marker.axis_x.getValue(d));
                })
                .transition().duration(duration).ease("linear")
                .attr("y", function(d) {
                    return _this.yScale(_this.model.marker.axis_y.getValue(d));
                })
                .attr("height", function(d) {
                    return _this.height - _this.yScale(_this.model.marker.axis_y.getValue(d));
                });
        },

        /**
         * Executes everytime the container or vizabi is resized
         * Ideally,it contains only operations related to size
         */
        resize: function() {

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

            this.graph
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

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

            this.xAxisEl.attr("transform", "translate(0," + this.height + ")")
                .call(this.xAxis);

            this.xScale.rangeRoundBands([0, this.width], 0.1, 0.2);

            this.yAxisEl.call(this.yAxis);
            this.xAxisEl.call(this.xAxis);

        },


        drawBars: function() {

        }
    });

    //BAR CHART TOOL
    var BarChart = Vizabi.Tool.extend('BarChart', {

        /**
         * Initializes the tool (Bar Chart Tool).
         * Executed once before any template is rendered.
         * @param {Object} config Initial config, with name and placeholder
         * @param {Object} options Options such as state, data, etc
         */
        init: function(config, options) {

            this.name = "barchart";

            //specifying components
            this.components = [{
                component: 'gapminder-barchart',
                placeholder: '.vzb-tool-viz',
                model: ["state.time", "state.entities", "state.marker", "language"] //pass models to component
            }, {
                component: 'gapminder-timeslider',
                placeholder: '.vzb-tool-timeslider',
                model: ["state.time"]
            }, {
                component: 'gapminder-buttonlist',
                placeholder: '.vzb-tool-buttonlist',
                model: ['state', 'ui', 'language']
            }];

            //constructor is the same as any tool
            this._super(config, options);
        },

        /**
         * Validating the tool model
         * @param model the current tool model to be validated
         */
        validate: function(model) {

            model = this.model || model;

            var time = model.state.time;
            var marker = model.state.marker.label;

            //don't validate anything if data hasn't been loaded
            if (!marker.getItems() || marker.getItems().length < 1) {
                return;
            }

            var dateMin = marker.getLimits(time.getDimension()).min;
            var dateMax = marker.getLimits(time.getDimension()).max;

            if (time.start < dateMin) {
                time.start = dateMin;
            }
            if (time.end > dateMax) {
                time.end = dateMax;
            }
        }
    });

    BarChart.define('default_options', {
        state: {
            time: {
            },
            entities: {
                dim: "geo",
                show: {
                    _defs_: {
                        "geo": ["*"],
                        "geo.cat": ["region"]
                    }
                }
            },
            marker: {
                space: ["entities", "time"],
                label: {
                    use: "property",
                    which: "geo.name"
                },
                axis_y: {
                    use: "indicator",
                    which: "lex",
                },
                axis_x: {
                    use: "property",
                    which: "geo.name"
                },
                color: {
                    use: "property",
                    which: "geo.region"
                }
            }
        },
        data: {
            reader: "csv-file",
            path: "local_data/waffles/{{LANGUAGE}}/basic-indicators.csv"
        },

        ui: {
            buttons: []
        },

        language: {
            id: "en",
            strings: {
                _defs_: {
                    en: {
                        "title": "",
                        "buttons/expand": "Go Big",
                        "buttons/unexpand": "Go Small",
                        "buttons/lock": "Lock",
                        "buttons/find": "Find",
                        "buttons/colors": "Colors",
                        "buttons/size": "Size",
                        "buttons/axes": "Axes",
                        "buttons/more_options": "Options"
                    }
                }
            }
        }
    });

}).call(this);