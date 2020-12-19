function TuningManager () {
    "use strict";
    let self = {};

    self.mode = "balance";

    self.tune_for_food = function () {
        let n_woodcutters = civData.woodcutter.owned;
        let n_miners = civData.miner.owned;
        let n_idle = civData.unemployed.owned;
        let n_available = n_woodcutters + n_miners + n_idle;

        civData.farmer.owned += n_available;

        civData.woodcutter.owned -= n_woodcutters;
        civData.miner.owned -= n_miners;
        civData.unemployed.owned -= n_idle;
    };

    self.tune_for_wood = function () {
        let n_farmers_needed = computer.calculate_farmers_required();
        let n_farmers = civData.farmer.owned;
        let delta_farmers = n_farmers - n_farmers_needed;
        let n_miners = civData.miner.owned;
        let n_idle = civData.unemployed.owned;
        let n_available = delta_farmers + n_miners + n_idle;

        civData.woodcutter.owned += n_available;

        civData.farmer.owned -= delta_farmers;
        civData.miner.owned -= n_miners;
        civData.unemployed.owned -= n_idle;
    };

    self.tune_for_stone = function () {
        let n_farmers_needed = computer.calculate_farmers_required();
        let n_farmers = civData.farmer.owned;
        let delta_farmers = n_farmers - n_farmers_needed;
        let n_woodcutters = civData.woodcutter.owned;
        let n_idle = civData.unemployed.owned;
        let n_available = delta_farmers + n_woodcutters + n_idle;

        civData.miner.owned += n_available;

        civData.farmer.owned -= delta_farmers;
        civData.woodcutter.owned -= n_woodcutters;
        civData.unemployed.owned -= n_idle;
    };

    self.tune_for_resources = function () {
        let n_farmers_needed = computer.calculate_farmers_required();
        let n_farmers = civData.farmer.owned;
        let delta_farmers = n_farmers - n_farmers_needed;
        let n_woodcutters = civData.woodcutter.owned;
        let n_miners = civData.miner.owned;
        let n_idle = civData.unemployed.owned;
        let n_available = delta_farmers + n_woodcutters + n_miners + n_idle;
        let excess = n_available % 2;

        n_woodcutters = Math.floor(n_available / 2);
        n_miners = Math.floor(n_available / 2);

        if (civData.wood.owned <= civData.stone.owned) {
            n_woodcutters += excess;
        } else {
            n_miners += excess;
        }

        civData.woodcutter.owned = n_woodcutters;
        civData.miner.owned = n_miners;
        civData.farmer.owned -= delta_farmers;
        civData.unemployed.owned -= n_idle;
    };

    self.tune_for_balance = function () {
        let n_farmers_needed = computer.calculate_farmers_required();
        let n_farmers = civData.farmer.owned;
        let delta_farmers = n_farmers - n_farmers_needed;
        let n_woodcutters = civData.woodcutter.owned;
        let n_miners = civData.miner.owned;
        let n_idle = civData.unemployed.owned;
        let n_available = delta_farmers + n_woodcutters + n_miners + n_idle;
        let excess = n_available % 3;

        let gain_farmers = Math.floor(n_available / 3);
        n_woodcutters = Math.floor(n_available / 3);
        n_miners = Math.floor(n_available / 3);

        if (civData.food.owned <= civData.wood.owned && civData.food.owned <= civData.stone.owned) {
            gain_farmers += excess;
        } else if (civData.wood.owned <= civData.food.owned && civData.wood.owned <= civData.stone.owned) {
            n_woodcutters += excess;
        } else {
            n_miners += excess;
        }

        civData.woodcutter.owned = n_woodcutters;
        civData.miner.owned = n_miners;
        civData.farmer.owned -= delta_farmers;
        civData.farmer.owned += gain_farmers;
        civData.unemployed.owned -= n_idle;
    };

    self.heartbeat = function() {
        document.getElementById("span_tuning_span").textContent = self.mode;
        if (self.mode === "none") {
            return;
        }

        if (self.mode === "food") {
            self.tune_for_food();
        }

        if (self.mode === "wood") {
            self.tune_for_wood();
        }

        if (self.mode === "stone") {
            self.tune_for_stone();
        }

        if (self.mode === "resources") {
            self.tune_for_resources();
        }

        if (self.mode === "balance") {
            self.tune_for_balance();
        }
    };

    self.set_mode = function (mode) {
        self.mode = mode;
        document.getElementById("span_tuning_span").textContent = self.mode;
    };

    return self;
}

var tuner = new TuningManager();

function doTuning() {
    tuner.heartbeat();
}