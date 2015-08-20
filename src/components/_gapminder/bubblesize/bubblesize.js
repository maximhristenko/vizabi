/*!
 * VIZABI BUBBLE SIZE slider
 * Reusable bubble size slider
 */

(function() {

    "use strict";

    var root = this;
    var Vizabi = root.Vizabi;
    var utils = Vizabi.utils;

    //warn client if d3 is not defined
    if (!Vizabi._require('d3')) {
        return;
    }

    var min = 1, max = 100;

    Vizabi.Component.extend('gapminder-bubblesize', {

        /**
         * Initializes the timeslider.
         * Executed once before any template is rendered.
         * @param config The options passed to the component
         * @param context The component's parent
         */
        init: function(config, context) {
            this.template = this.template || "src/components/_gapminder/bubblesize/bubblesize.html";
            
            this.model_expects = [{
                name: "size",
                type: "size"
            }];

            //contructor is the same as any component
            this._super(config, context);
        },

        /**
         * Executes after the template is loaded and rendered.
         * Ideally, it contains HTML instantiations related to template
         * At this point, this.element and this.placeholder are available as a d3 object
         */
        readyOnce: function() {
            var value = this.model.size.max,
                _this = this;
            this.element = d3.select(this.element);
            this.indicatorEl = this.element.select('#vzb-bs-indicator');
            this.sliderEl = this.element.selectAll('#vzb-bs-slider');

            this.sliderEl
                .attr('min', 0)
                .attr('max', 1)
                .attr('step', 0.01)
                .attr('value', value)
                .on('input', function() {
                    _this.slideHandler();
                });
        },

        /**
         * Executes everytime there's a data event.
         * Ideally, only operations related to changes in the model
         * At this point, this.element is available as a d3 object
         */
        modelReady: function() {
            this.indicatorEl.text(this.model.size.max);
        },

        /**
         * Executes everytime the container or vizabi is resized
         * Ideally,it contains only operations related to size
         */
        resize: function() {
            //E.g: var height = this.placeholder.style('height');
        },

        slideHandler: function() {
            this._setValue(+d3.event.target.value);
        },

        /**
         * Sets the current value in model. avoid updating more than once in framerate
         * @param {number} value 
         */
        _setValue: function(value) {
            var frameRate = 50;

            //implement throttle
            var now = new Date();
            if (this._updTime != null && now - this._updTime < frameRate) return;
            this._updTime = now;

            this.model.size.max = value;
        }
    });

}).call(this);