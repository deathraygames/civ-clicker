function AutopilotManager () {
    "use strict";
    let self = {};

    self.mode = "none";

    self.auto_populate = true;
    self.auto_build_accommodation = true;
    self.free_land_limit = 0.9;

    self.build_accommodation = function () {
        let fraction_land_used = 1.0 * landTotals.buildings / landTotals.lands
        if (fraction_land_used >= self.free_land_limit) {
            return;
        }

        
    };

    self.heartbeat = function() {
        document.getElementById("span_autopilot_span").textContent = self.mode;

        if (self.auto_populate === true) {
            spawn(Infinity);
        }
    };

    self.set_mode = function (mode) {
        self.mode = mode;
        document.getElementById("span_autopilot_span").textContent = self.mode;
    };

    return self;
}

var autopilot = new AutopilotManager();

function doAutopilot() {
    autopilot.heartbeat();
}
