/*
 * VIZABI Data Model (options.data)
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

    Vizabi.Model.extend('size', {

        /**
         * Initializes the color hook
         * @param {Object} values The initial values of this model
         * @param parent A reference to the parent model
         * @param {Object} bind Initial events to bind
         */
        init: function(values, parent, bind) {

            this._type = "size";
            values = utils.extend({
                use: "value",
                unit: "",
                which: undefined
            }, values);
            this._super(values, parent, bind);
        },

        /**
         * Validates a color hook
         */
        validate: function() {
            //there must be a min and a max
            if (typeof this.min === 'undefined' || this.min < 0) {
                this.min = 0;
            }
            if (typeof this.max === 'undefined' || this.max > 1) {
                this.max = 1;
            }
            if (this.min > this.max) {
                this.min = this.max;
            }
            //value must always be between min and max
            if (this.use === "value" && this.which > this.max) {
                this.which = this.max;
            }
            else if (this.use === "value" && this.which < this.min) {
                this.which = this.min;
            }
            if (!this.scaleType) {
                this.scaleType = 'linear';
            }
            if (this.use === "property") {
                this.scaleType = 'ordinal';
            }
            
            //TODO a hack that kills the scale, it will be rebuild upon getScale request in model.js
            if(this.which_1 != this.which || this.scaleType_1 != this.scaleType) this.scale = null;
            this.which_1 = this.which;
            this.scaleType_1 = this.scaleType;
        },

        /**
         * Gets the domain for this hook
         * @returns {Array} domain
         */
        buildScale: function() {
            if(this.use === "value") {
                this.scale = d3.scale.linear().domain([0,1]);
            }
            this._super();
        }

    });

}).call(this);