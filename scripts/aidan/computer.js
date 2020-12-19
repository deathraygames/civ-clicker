function Computer () {
    "use strict";
    let self = {};

    self.count_workers = function () {
        let n_workers = (
            civData.farmer.owned
            + civData.woodcutter.owned
            + civData.miner.owned
        );
        return n_workers;
    };

    self.calculate_farmers_required = function () {
        let food_needed = population.living;
        let specialChance = civData.food.specialChance + (0.1 * civData.flensing.owned);
        let millMod = 1;
        if (population.current > 0) { 
            millMod = population.living / population.current; 
        }
        let farmers_required = (
            food_needed / (
                (1 + (civData.farmer.efficiency * curCiv.morale.efficiency)) 
                * ((civData.pestControl.timer > 0) ? 1.01 : 1) 
                * getWonderBonus(civData.food) 
                * (1 + civData.walk.rate/120) 
                * (1 + civData.mill.owned * millMod / 200)
            )
        );
        farmers_required = Math.floor(1 + farmers_required);
        return farmers_required;
    };

    self.calculate_farmers = function (do_prob_rounding) {
        let specialChance = civData.food.specialChance + (0.1 * civData.flensing.owned);
        let millMod = 1;
        if (population.current > 0) { 
            millMod = population.living / population.current; 
        }
        let food_net = (
            civData.farmer.owned 
            * (1 + (civData.farmer.efficiency * curCiv.morale.efficiency)) 
            * ((civData.pestControl.timer > 0) ? 1.01 : 1) 
            * getWonderBonus(civData.food) 
            * (1 + civData.walk.rate/120) 
            * (1 + civData.mill.owned * millMod / 200) //Farmers farm food
        );
        let skins_net = 0;

        food_net -= population.living; //The living population eats food.

        if (civData.skinning.owned && civData.farmer.owned > 0){ //and sometimes get skins
            let skinsChance = (
                specialChance
                * (civData.food.increment + ((civData.butchering.owned) * civData.farmer.owned / 15.0))
                * getWonderBonus(civData.skins)
            );
            if (do_prob_rounding) {
                skinsChance = rndRound(skinsChance);
            }
            skins_net = Math.floor(skinsChance);
        }

        let output = {
            food_net: food_net,
            skins_net: skins_net
        }
        return output;
    };

    self.calculate_woodcutters = function (do_prob_rounding) {
        let wood_net = (
            civData.woodcutter.owned
            * (civData.woodcutter.efficiency
            * curCiv.morale.efficiency)
            * getWonderBonus(civData.wood)
        ); //Woodcutters cut wood
        let herbs_net = 0;

        if (civData.harvesting.owned && civData.woodcutter.owned > 0){ //and sometimes get herbs
            var herbsChance = (
                civData.wood.specialChance
                * (civData.wood.increment + ((civData.gardening.owned)
                * civData.woodcutter.owned / 5.0)) 
                * getWonderBonus(civData.herbs)
            );
            if (do_prob_rounding) {
                herbsChance = rndRound(herbsChance);
            }
            herbs_net = Math.floor(herbsChance);
        }

        let output = {
            wood_net: wood_net,
            herbs_net: herbs_net
        }
        return output;
    };

    self.calculate_miners = function (do_prob_rounding) {
        let specialChance = civData.stone.specialChance + (civData.macerating.owned ? 0.1 : 0);
        let stone_net = (
            civData.miner.owned
            * (civData.miner.efficiency * curCiv.morale.efficiency)
            * getWonderBonus(civData.stone)
        );

        let ore_net = 0;
        if (civData.prospecting.owned && civData.miner.owned > 0){
            let oreChance = (
                specialChance
                * (civData.stone.increment + ((civData.extraction.owned)
                * civData.miner.owned / 5.0))
                * getWonderBonus(civData.ore)
            );
            if (do_prob_rounding) {
                oreChance = rndRound(oreChance);
            }
            ore_net = Math.floor(oreChance);
        }

        let output = {
            stone_net: stone_net,
            ore_net: ore_net
        }
        return output;
    };

    self.calculate_blacksmiths = function() {
        let ore_used = Math.min(
            civData.ore.owned,
            (civData.blacksmith.owned * civData.blacksmith.efficiency * curCiv.morale.efficiency)
        );
        let metal_earned = ore_used * getWonderBonus(civData.metal);

        let output = {
            ore_used: ore_used,
            metal_earned: metal_earned
        }
        return output;
    };

    self.calculate_tanners = function() {
        let skins_used = Math.min(
            civData.skins.owned,
            (civData.tanner.owned * civData.tanner.efficiency * curCiv.morale.efficiency)
        );
        let leather_earned = skins_used * getWonderBonus(civData.leather);

        let output = {
            skins_used: skins_used,
            leather_earned: leather_earned
        }
        return output;
    };

    self.calculate_clerics = function() {
        let piety_earned = (
            civData.cleric.owned 
            * (civData.cleric.efficiency + (civData.cleric.efficiency * (civData.writing.owned))) 
            * (1 + ((civData.secrets.owned) 
            * (1 - 100/(civData.graveyard.owned + 100)))) 
            * curCiv.morale.efficiency 
            * getWonderBonus(civData.piety)
        );

        let output = {
            piety_earned: piety_earned
        }
        return output;
    };

    self.heartbeat = function() {
    };

    return self;
}

var computer = new Computer();

function doComputer() {
    computer.heartbeat();
}