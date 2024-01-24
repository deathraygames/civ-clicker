/* eslint-disable quotes, prefer-template, no-plusplus, prefer-const, no-param-reassign */
// TODO: Clean up coade and the remove these disables ^
import { isValid, dataset, logSearchFn } from './jsutils.js';
import { sgn, abs } from './number-formatters.js';
import { civSizes, idToType } from './civclicker-data.js';

// Update functions. Called by other routines in order to update the interface.

function updateAll(inputData) {
	const {
		upgradeData, basicResources, homeBuildings,
		homeUnits, armyUnits,
		population,
		unitData, buildingData, powerData,
		curWonder, wonders,
	} = inputData;
	this.updateTrader();
	this.updateUpgrades(upgradeData);
	this.updateResourceRows(basicResources); // Update resource display
	this.updateBuildingButtons(homeBuildings);
	this.updateJobButtons(homeUnits);
	this.updatePartyButtons(armyUnits);
	this.updatePopulation(population, homeUnits, armyUnits, unitData);
	this.updateTargets();
	this.updateDevotion(population, buildingData, powerData);
	this.updateWonder(curWonder, wonders);
	this.updateReset();
}

function updateWonderList(wonders) {
	const { ui } = this;
	if (wonders.length === 0) { return; }
	let i;
	// update wonder list
	let wonderhtml = "<tr><td><strong>Name</strong></td><td><strong>Type</strong></td></tr>";
	for (i = (wonders.length - 1); i >= 0; --i) {
		try {
			wonderhtml += "<tr><td>" + wonders[i].name + "</td><td>" + wonders[i].resourceId + "</td></tr>";
		} catch (err) {
			console.log("Could not build wonder row " + i);
		}
	}
	ui.find("#pastWonders").innerHTML = wonderhtml;
}

function updateReset() {
	const { civInterface, ui } = this;
	const worshipOwned = Boolean(civInterface.getWorshipOwned());
	const curWonder = civInterface.getCurrentWonder();
	ui.show("#resetNote", (worshipOwned || curWonder.stage === 3));
	ui.show("#resetDeity", (worshipOwned));
	ui.show("#resetWonder", (curWonder.stage === 3));
	ui.show("#resetBoth", (worshipOwned && curWonder.stage === 3));
}

function updateAfterReset(inputData) {
	const {
		upgradeData,
		homeUnits, armyUnits,
		population,
		buildingData, powerData,
		curWonder, wonders,
		deities,
	} = inputData;
	const { ui, civInterface, prettify } = this;
	const civData = civInterface.getCivData();
	this.updateRequirements(civData.mill);
	this.updateRequirements(civData.fortification);
	this.updateRequirements(civData.battleAltar);
	this.updateRequirements(civData.fieldsAltar);
	this.updateRequirements(civData.underworldAltar);
	this.updateRequirements(civData.catAltar);

	ui.find("#graceCost").innerHTML = prettify(civData.grace.cost);
	// Update page with all new values
	this.updateResourceTotals();
	this.updateUpgrades(upgradeData);
	this.updateDeity();
	this.makeDeitiesTables(deities);
	this.updateDevotion(population, buildingData, powerData);
	this.updateTargets();
	this.updateJobButtons(homeUnits);
	this.updatePartyButtons(armyUnits);
	this.updateWonder(curWonder, wonders);
	// Reset upgrades and other interface elements that might have been unlocked
	// xxx Some of this probably isn't needed anymore; the update routines will handle it.
	ui.find("#renameDeity").disabled = "true";
	ui.find("#raiseDead").disabled = "true";
	ui.find("#raiseDead100").disabled = "true";
	ui.find("#raiseDeadMax").disabled = "true";
	ui.find("#smite").disabled = "true";
	ui.find("#wickerman").disabled = "true";
	ui.find("#pestControl").disabled = "true";
	ui.find("#grace").disabled = "true";
	ui.find("#walk").disabled = "true";
	ui.find("#ceaseWalk").disabled = "true";
	ui.find("#lure").disabled = "true";
	ui.find("#companion").disabled = "true";
	ui.find("#comfort").disabled = "true";
	ui.find("#book").disabled = "true";
	ui.find("#feast").disabled = "true";
	ui.find("#blessing").disabled = "true";
	ui.find("#waste").disabled = "true";
	ui.find("#riddle").disabled = "true";
	ui.find("#throne").disabled = "true";
	ui.find("#glory").disabled = "true";
	ui.find("#summonShade").disabled = "true";
	ui.find("#conquest").style.display = "none";
	ui.find(".alert").style.display = "none";
	ui.find("#tradeContainer").style.display = "none";
	ui.find("#tradeUpgradeContainer").style.display = "none";
	ui.find("#iconoclasmList").innerHTML = "";
	ui.find("#iconoclasm").disabled = false;
}

function updateTrader() {
	const { civInterface, ui, prettify } = this;
	const civData = civInterface.getCivData();
	const trader = civInterface.getTrader();
	let isHere = civInterface.isTraderHere();
	if (isHere) {
		ui.find("#tradeType").innerHTML = civData[trader.materialId].getQtyName(trader.requested);
		ui.find("#tradeRequested").innerHTML = prettify(trader.requested);
		ui.find("#traderTimer").innerHTML = trader.timer + " second" + ((trader.timer !== 1) ? "s" : "");
	}
	ui.show("#tradeContainer", isHere);
	ui.show("#noTrader", !isHere);
	ui.show("#tradeSelect .alert", isHere);
	return isHere;
}

// xxx This should become an onGain() member method of the building classes
function updateRequirements(buildingObj) {
	const { civInterface } = this;
	let displayNode = document.getElementById(buildingObj.id + "Cost");
	if (displayNode) { displayNode.innerHTML = civInterface.getReqText(buildingObj.require); }
}

function updatePurchaseRow(purchaseObj) {
	const { civInterface, ui } = this;
	if (!purchaseObj) { return; }

	let elem = ui.find("#" + purchaseObj.id + "Row");
	if (!elem) { console.warn("Missing UI element for " + purchaseObj.id); return; }

	// If the item's cost is variable, update its requirements.
	if (purchaseObj.hasVariableCost()) { this.updateRequirements(purchaseObj); }

	// Already having one reveals it as though we met the prereq.
	let havePrereqs = (purchaseObj.owned > 0)
		|| civInterface.meetsUpgradePrereqs(purchaseObj.prereqs);

	let isOwned = typeof purchaseObj.owned === 'boolean'
		? purchaseObj.owned
		: purchaseObj.owned === purchaseObj.limit;
	// Special check: Hide one-shot upgrades after purchase; they're
	// redisplayed elsewhere.
	let hideBoughtUpgrade = (
		(purchaseObj.type === "upgrade")
		&& (isOwned)
		&& !purchaseObj.salable
	);

	let maxQty = civInterface.canPurchase(purchaseObj);
	let minQty = civInterface.canPurchase(purchaseObj, -Infinity);

	let buyElems = elem.querySelectorAll("[data-action='purchase']");

	buyElems.forEach((elt) => {
		let purchaseQty = dataset(elt, "quantity");
		// Treat 'custom' or Infinity as +/-1.
		// xxx Should we treat 'custom' as its appropriate value instead?
		let absQty = abs(purchaseQty);
		if ((absQty === "custom") || (absQty === "Infinity")) {
			purchaseQty = sgn(purchaseQty);
		}
		elt.disabled = ((purchaseQty > maxQty) || (purchaseQty < minQty));
	});

	// Reveal the row if  prereqs are met
	ui.show(elem, havePrereqs && !hideBoughtUpgrade);
}

// Only set up for the basic resources right now.
function updateResourceRows(basicResources) {
	basicResources.forEach((elem) => { this.updatePurchaseRow(elem); });
}
// Enables/disabled building buttons - calls each type of building in turn
// Can't do altars; they're not in the proper format.
function updateBuildingButtons(homeBuildings) {
	homeBuildings.forEach((elem) => { this.updatePurchaseRow(elem); });
}
// Update the page with the latest worker distribution and stats
function updateJobButtons(homeUnits) {
	homeUnits.forEach((elem) => { this.updatePurchaseRow(elem); });
}
// Updates the party (and enemies)
function updatePartyButtons(armyUnits) {
	armyUnits.forEach((elem) => { this.updatePurchaseRow(elem); });
}

// xxx Maybe add a function here to look in various locations for vars, so it
// doesn't need multiple action types?
function updateResourceTotals() {
	const { civInterface, ui, prettify } = this;
	const civData = civInterface.getCivData();
	let i;
	let displayElems;
	let elem;
	let val;
	let landTotals = civInterface.getLandTotals();

	// Scan the HTML document for elements with a "data-action" element of
	// "display".  The "data-target" of such elements (or their ancestors)
	// is presumed to contain
	// the global variable name to be displayed as the element's content.
	// xxx Note that this is now also updating nearly all updatable values,
	// including population
	displayElems = document.querySelectorAll("[data-action='display']");
	for (i = 0; i < displayElems.length; ++i) {
		elem = displayElems[i];
		// xxx Have to use civ here because of zombies and other non-civData displays.
		const what = dataset(elem, "target");
		elem.innerHTML = prettify(Math.floor(civInterface.getOwned(what)));
	}

	// Update net production values for primary resources.  Same as the above,
	// but look for "data-action" == "displayNet".
	displayElems = document.querySelectorAll("[data-action='displayNet']");
	for (i = 0; i < displayElems.length; ++i) {
		elem = displayElems[i];
		val = civData[dataset(elem, "target")].net;
		if (!isValid(val)) { continue; } // eslint-disable-line no-continue

		// Colourise net production values.
		let color = '#000';
		if (val < 0) color = '#f00';
		else if (val > 0) color = '#0b0';
		elem.style.color = color;
		elem.innerHTML = ((val < 0) ? "" : "+") + prettify(val.toFixed(1));
	}

	// if (civData.gold.owned >= 1){
	//	ui.show("#goldRow",true);
	// }

	// Update page with building numbers, also stockpile limits.
	ui.find("#maxfood").innerHTML = prettify(civData.food.limit);
	ui.find("#maxwood").innerHTML = prettify(civData.wood.limit);
	ui.find("#maxstone").innerHTML = prettify(civData.stone.limit);
	ui.find("#totalBuildings").innerHTML = prettify(landTotals.buildings);
	ui.find("#totalLand").innerHTML = prettify(landTotals.lands);

	// Unlock advanced control tabs as they become enabled (they never disable)
	// Temples unlock Deity, barracks unlock Conquest, having gold unlocks Trade.
	// Deity is also unlocked if there are any prior deities present.
	const deities = civInterface.getDeities();
	if ((civData.temple.owned > 0) || (deities.length > 1)) { ui.show("#deitySelect", true); }
	if (civData.barracks.owned > 0) { ui.show("#conquestSelect", true); }
	if (civData.gold.owned > 0) { ui.show("#tradeSelect", true); }

	// Need to have enough resources to trade
	const trader = civInterface.getTrader();
	ui.find("#tradeButton").disabled = (
		!trader || !trader.timer
		|| (civData[trader.materialId].owned < trader.requested)
	);

	// Cheaters don't get names.
	ui.find("#renameRuler").disabled = civInterface.isCheater();
}

// Update page with numbers
function updatePopulation(population, homeUnits, armyUnits, unitData, calc) {
	const {
		civInterface, ui, prettify, settings,
	} = this;
	const civData = civInterface.getCivData();
	const achData = civInterface.getAchData();
	let i;
	let elems;
	let displayElems;
	let spawn1button = ui.find("#spawn1button");
	let spawnCustomButton = ui.find("#spawnCustomButton");
	let spawnMaxbutton = ui.find("#spawnMaxbutton");
	let spawn10button = ui.find("#spawn10button");
	let spawn100button = ui.find("#spawn100button");
	let spawn1000button = ui.find("#spawn1000button");

	if (calc) { civInterface.calculatePopulation(); }

	// Scan the HTML document for elements with a "data-action" element of
	// "display_pop".  The "data-target" of such elements is presumed to contain
	// the population subproperty to be displayed as the element's content.
	// xxx This selector should probably require data-target too.
	// xxx Note that relatively few values are still stored in the population
	// struct; most of them are now updated by the 'display' action run
	// by updateResourceTotals().
	displayElems = document.querySelectorAll("[data-action='display_pop']");
	displayElems.forEach((elt) => {
		const prop = dataset(elt, "target");
		elt.innerHTML = prettify(Math.floor(population[prop]));
	});

	// TODO: Effect might change dynamically.  Need a more general way to do this.
	civData.house.update();
	civData.barn.update();

	ui.show("#graveTotal", (civInterface.getGravesOwned() > 0));
	ui.show("#totalSickRow", (population.totalSick > 0));

	// As population increases, various things change
	// Update our civ type name
	ui.find("#civType").innerHTML = civInterface.getCivType();

	// Unlocking interface elements as population increases to reduce unnecessary clicking
	// xxx These should be reset in reset()
	if (population.current >= 10) {
		if (!settings.customIncr) {
			elems = document.getElementsByClassName("unit10");
			for (i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
		}
	}
	if (population.current >= 100) {
		if (!settings.customIncr) {
			elems = document.getElementsByClassName("building10");
			for (i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
			elems = document.getElementsByClassName("unit100");
			for (i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
		}
	}
	if (population.current >= 1000) {
		if (!settings.customIncr) {
			elems = document.getElementsByClassName("building100");
			for (i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
			elems = document.getElementsByClassName("unit1000");
			for (i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
			elems = document.getElementsByClassName("unitInfinity");
			for (i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
		}
	}
	if (population.current >= 10000) {
		if (!settings.customIncr) {
			elems = document.getElementsByClassName("building1000");
			for (i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
		}
	}

	// Turning on/off buttons based on free space.
	let maxSpawn = Math.max(0, Math.min(
		(population.limit - population.living),
		logSearchFn(civInterface.calcWorkerCost, civData.food.owned),
	));

	spawn1button.disabled = (maxSpawn < 1);
	spawnCustomButton.disabled = (maxSpawn < 1);
	spawnMaxbutton.disabled = (maxSpawn < 1);
	spawn10button.disabled = (maxSpawn < 10);
	spawn100button.disabled = (maxSpawn < 100);
	spawn1000button.disabled = (maxSpawn < 1000);

	let canRaise = (civInterface.getCurDeityDomain() === "underworld" && civData.devotion.owned >= 20);
	let maxRaise = canRaise ? logSearchFn(civInterface.calcZombieCost, civData.piety.owned) : 0;
	ui.show("#raiseDeadRow", canRaise);
	ui.find("#raiseDead").disabled = (maxRaise < 1);
	ui.find("#raiseDeadMax").disabled = (maxRaise < 1);
	ui.find("#raiseDead100").disabled = (maxRaise < 100);

	// Calculates and displays the cost of buying workers at the current population
	ui.find("#raiseDeadCost").innerHTML = prettify(Math.round(civInterface.calcZombieCost(1)));

	ui.find("#workerNumMax").innerHTML = prettify(Math.round(maxSpawn));

	spawn1button.title = "Cost: " + prettify(Math.round(civInterface.calcWorkerCost(1))) + " food";
	spawn10button.title = "Cost: " + prettify(Math.round(civInterface.calcWorkerCost(10))) + " food";
	spawn100button.title = "Cost: " + prettify(Math.round(civInterface.calcWorkerCost(100))) + " food";
	spawn1000button.title = "Cost: " + prettify(Math.round(civInterface.calcWorkerCost(1000))) + " food";
	spawnMaxbutton.title = "Cost: " + prettify(Math.round(civInterface.calcWorkerCost(maxSpawn))) + " food";

	ui.find("#workerCost").innerHTML = prettify(Math.round(civInterface.calcWorkerCost(1)));

	this.updateJobButtons(homeUnits); // handles the display of units in the player's kingdom.
	this.updatePartyButtons(armyUnits); // handles the display of units out on raids.
	this.updateMorale(population, civInterface.getMoraleEfficiency());
	this.updateAchievements(achData); // handles display of achievements
	this.updatePopulationBar(population, unitData);
	this.updateLandBar();
}

function updatePopulationBar(population, unitData) {
	const { ui } = this;
	let barElt = ui.find("#populationBar");
	let h = '';
	function getUnitPercent(x, y) {
		return (Math.floor(100000 * (x / y)) / 1000);
	}
	unitData.forEach((unit) => {
		let p;
		if (unit.isPopulation) {
			p = getUnitPercent(unit.owned, population.current);
			h += (
				'<div class="' + unit.id + '" '
				+ ' style="width: ' + p + '%">'
				+ '<span>' + (Math.round(p * 10) / 10) + '% ' + unit.plural + '</span>'
				+ '</div>'
			);
		}
	});
	barElt.innerHTML = (
		'<div style="min-width: ' + getUnitPercent(population.current, population.limitIncludingUndead) + '%">'
		+ h
		+ '</div>'
	);
}

function updateLandBar() {
	const { civInterface, ui } = this;
	let barElt = ui.find("#landBar");
	let landTotals = civInterface.getLandTotals();
	let p = (Math.floor(1000 * (landTotals.buildings / landTotals.lands)) / 10);
	barElt.innerHTML = ('<div style="width: ' + p + '%"></div>');
}

// Check to see if the player has an upgrade and hide as necessary
// Check also to see if the player can afford an upgrade and enable/disable as necessary
function updateUpgrades(upgradeData) {
	const { civInterface, ui } = this;
	const civData = civInterface.getCivData();
	const worshipOwned = civInterface.getWorshipOwned();
	let domain = civInterface.getCurDeityDomain();
	let hasDomain = Boolean(domain !== "");
	let canSelectDomain = Boolean(worshipOwned && !hasDomain);

	// Update all of the upgrades
	upgradeData.forEach((elem) => {
		this.updatePurchaseRow(elem); // Update the purchase row.
		// Show the already-purchased line if we've already bought it.
		ui.show(("#P" + elem.id), elem.owned);
	});

	// Deity techs
	ui.show("#deityPane .notYet", (!hasDomain && !canSelectDomain));
	ui.find("#renameDeity").disabled = (!worshipOwned);
	ui.show("#battleUpgrades", (domain === "battle"));
	ui.show("#fieldsUpgrades", (domain === "fields"));
	ui.show("#underworldUpgrades", (domain === "underworld"));
	ui.show("#zombieWorkers", (civInterface.getZombiesOwned() > 0));
	ui.show("#catsUpgrades", (domain === "cats"));

	ui.show("#deityDomains", canSelectDomain);
	ui.findAll("#deityDomains button.purchaseFor500Piety").forEach((button) => {
		button.disabled = (!canSelectDomain || (civData.piety.owned < 500));
	});
	// ui.show("#deitySelect .alert", canSelectDomain);

	ui.show("#" + domain + "Upgrades", hasDomain);

	// Conquest / battle standard
	ui.show("#conquest", civData.standard.owned);
	ui.show("#conquestPane .notYet", (!civData.standard.owned));

	// Trade
	ui.show("#tradeUpgradeContainer", civData.trade.owned);
	ui.show("#tradePane .notYet", !civData.trade.owned);
}

function updateDeity() {
	const { civInterface, ui } = this;
	const civData = civInterface.getCivData();
	const deities = civInterface.getDeities();
	const hasDeity = Boolean(deities[0].name);
	// Update page with deity details
	ui.find("#deityAName").innerHTML = deities[0].name;
	ui.find("#deityADomain").innerHTML = civInterface.getCurDeityDomain() ? ", deity of " + idToType(civInterface.getCurDeityDomain()) : "";
	ui.find("#deityADevotion").innerHTML = civData.devotion.owned;

	// Display if we have an active deity, or any old ones.
	ui.show("#deityContainer", hasDeity);
	ui.show("#activeDeity", hasDeity);
	ui.show("#oldDeities", (hasDeity || deities.length > 1));
	ui.show("#pantheonContainer", (hasDeity || deities.length > 1));
	ui.show("#iconoclasmGroup", (deities.length > 1));
}

// Enables or disables availability of activated religious powers.
// Passive religious benefits are handled by the upgrade system.
function updateDevotion(population, buildingData, powerData) {
	const { civInterface, ui } = this;
	const civData = civInterface.getCivData(); // TODO: really need entire civData?
	ui.find("#deityADevotion").innerHTML = civData.devotion.owned;

	// Process altars
	buildingData.forEach((elem) => {
		if (elem.subType === "altar") {
			ui.show(("#" + elem.id + "Row"), civInterface.meetsUpgradePrereqs(elem.prereqs));
			document.getElementById(elem.id).disabled = (!(
				civInterface.meetsUpgradePrereqs(elem.prereqs) && civInterface.canAfford(elem.require)
			));
		}
	});

	// Process activated powers
	powerData.forEach((elem) => {
		if (elem.subType === "prayer") {
			// xxx raiseDead buttons updated by UpdatePopulationUI
			if (elem.id === "raiseDead") { return; }
			ui.show(("#" + elem.id + "Row"), civInterface.meetsUpgradePrereqs(elem.prereqs));
			document.getElementById(elem.id).disabled = !(
				civInterface.meetsUpgradePrereqs(elem.prereqs) && civInterface.canAfford(elem.require)
			);
		}
	});

	// xxx Smite should also be disabled if there are no foes.

	// xxx These costs are not yet handled by canAfford().
	if (population.healthy < 1) {
		ui.find("#wickerman").disabled = true;
		ui.find("#walk").disabled = true;
	}

	ui.find("#ceaseWalk").disabled = (civData.walk.rate === 0);
}

// Dynamically create the achievement display
function addAchievementRows(achData) {
	const { ui } = this;
	let s = '';
	achData.forEach((elem) => {
		s += (
			'<div class="achievement" title="' + elem.getQtyName() + '">'
			+ '<div class="unlockedAch" id="' + elem.id + '">' + elem.getQtyName() + '</div>'
			+ '</div>'
		);
	});
	ui.find("#achievements").innerHTML += s;
}

// Displays achievements if they are unlocked
function updateAchievements(achData) {
	const { ui } = this;
	achData.forEach((achObj) => {
		ui.show("#" + achObj.id, achObj.owned);
	});
}

// Dynamically add the raid buttons for the various civ sizes.
function addRaidRows(civSizesParam, onBulkEvent) {
	const { ui } = this;
	let s = '';
	civSizesParam.forEach((elem) => {
		s += (
			"<button class='raid' data-action='raid' data-target='" + elem.id
			+ "' disabled='disabled'>"
			+ "Raid " + elem.name + "</button>"
		); // xxxL10N
	});

	let group = ui.find("#raidGroup");
	group.innerHTML += s;
	group.onmousedown = onBulkEvent;
}

// Enable the raid buttons for eligible targets.
function updateTargets() {
	const { civInterface, ui } = this;
	const civData = civInterface.getCivData();
	const raid = civInterface.getRaid();
	let i;
	let raidButtons = document.getElementsByClassName("raid");
	let haveArmy = false;

	ui.show("#victoryGroup", raid.victory);

	// Raid buttons are only visible when not already raiding.
	if (ui.show("#raidGroup", !raid.raiding)) {
		if (civInterface.getCombatants("party", "player").length > 0) { haveArmy = true; }

		let curElem;
		for (i = 0; i < raidButtons.length; ++i) {
			// Disable if we have no standard, no army, or they are too big a target.
			curElem = raidButtons[i];
			curElem.disabled = (!civData.standard.owned || !haveArmy || (civSizes[dataset(curElem, "target")].idx > civSizes[raid.targetMax].idx));
		}
	}
}

/** Updates morale (aka. happiness) */
function updateMorale(population, moraleEfficiency) {
	const { ui } = this;
	let happinessRank; // Lower is better
	if (population.living < 1) happinessRank = null;
	else if (moraleEfficiency > 1.4) happinessRank = 1;
	else if (moraleEfficiency > 1.2) happinessRank = 2;
	else if (moraleEfficiency > 0.8) happinessRank = 3;
	else if (moraleEfficiency > 0.6) happinessRank = 4;
	else { happinessRank = 5; }
	// Loop through possible ranks
	[1, 2, 3, 4, 5].forEach((rank) => {
		const active = (rank === happinessRank);
		const elt = ui.find(`.happy-${rank}`);
		elt.classList[active ? 'add' : 'remove']('happy-active');
		// Hide inactive ranks so they're not spoken by screen readers
		elt.ariaHidden = !active;
	});
}

function addWonderSelectText(wonderResources) {
	const { ui } = this;
	let wcElem = ui.find("#wonderCompleted");
	if (!wcElem) { console.log("Error: No wonderCompleted element found."); return; }
	let s = wcElem.innerHTML;
	wonderResources.forEach((elem, i, wr) => {
		s += "<button onmousedown='wonderSelect(\"" + elem.id + "\")'>" + elem.getQtyName(0) + "</button>";
		// Add newlines to group by threes (but no newline for the last one)
		if (!((i + 1) % 3) && (i !== wr.length - 1)) { s += "<br />"; }
	});

	wcElem.innerHTML = s;
}

// updates the display of wonders and wonder building
function updateWonder(curWonder, wonders) {
	const { civInterface, ui } = this;
	let haveTech = civInterface.haveWonderTech();
	let isLimited = civInterface.isWonderLimited();
	let lowItem = civInterface.getWonderLowItem();
	const speedCost = { gold: 100 };

	ui.show("#lowResources", isLimited);
	ui.show("#upgradesSelect .alert", isLimited);

	if (lowItem) {
		ui.find("#limited").innerHTML = " by low " + lowItem.getQtyName();
	}

	if (curWonder.progress >= 100) {
		ui.find("#lowResources").style.display = "none";
	}
	// Display this section if we have any wonders or could build one.
	ui.show("#wondersContainer", (haveTech || wonders.length > 0));
	// Can start building a wonder, but haven't yet.
	ui.show("#startWonderLine", (haveTech && curWonder.stage === 0));
	ui.find("#startWonder").disabled = (!haveTech || curWonder.stage !== 0);
	// Construction in progress; show/hide building area and labourers
	ui.show("#labourerRow", (curWonder.stage === 1));
	ui.show("#wonderInProgress", (curWonder.stage === 1));
	ui.show("#speedWonderGroup", (curWonder.stage === 1));
	ui.find("#speedWonder").disabled = (curWonder.stage !== 1 || !civInterface.canAfford(speedCost));
	if (curWonder.stage === 1) {
		ui.find("#progressBar").style.width = curWonder.progress.toFixed(2) + "%";
		ui.find("#progressNumber").innerHTML = curWonder.progress.toFixed(2);
	}
	// Finished, but haven't picked the resource yet.
	ui.show("#wonderCompleted", (curWonder.stage === 2));
	this.updateWonderList(wonders);
}

function makeDeitiesTables(deities) { // copied from clickclicker
	const { ui } = this;
	// Display the active deity
	let deityId = "deityA";
	ui.find("#activeDeity").innerHTML = '<tr id="' + deityId + '">'
		+ '<td><strong><span id="' + deityId + 'Name"></span></strong>'
		+ '<span id="' + deityId + 'Domain" class="deityDomain"></span></td>'
		+ '<td>Devotion: <span id="' + deityId + 'Devotion"></span></td></tr>';

	// Display the table of prior deities.
	// xxx Change this to <th>, need to realign left.
	let s = "<tr><td><b>Name</b></td><td><b>Domain</b></td><td><b>Max Devotion</b></td></tr>";
	deities.forEach((elem, i) => {
		if ((i === 0) && (!elem.name)) { return; } // Don't display current deity-in-waiting.
		// TODO: Fix this use-before-define?
		s += getDeityRowText("deity" + i, elem); // eslint-disable-line no-use-before-define
	});
	ui.find("#oldDeities").innerHTML = s;
	// TODO: Fix this use-before-define?
	updater.updateDeity(); // eslint-disable-line no-use-before-define
}

function getDeityRowText(deityId, deityObj) {
	if (!deityObj) {
		// eslint-disable-next-line no-param-reassign
		deityObj = { name: "No deity", domain: "", maxDev: 0 };
	}
	return "<tr id='" + deityId + "'>"
	+ "<td><strong><span id='" + deityId + "Name'>" + deityObj.name + "</span></strong>"
	+ "<span id=" + deityId + "Domain' class='deityDomain'></td><td>" + idToType(deityObj.domain) + "</span></td>"
	+ "<td><span id='" + deityId + "Devotion'>" + deityObj.maxDev + "</span></td></tr>";
}

const updater = {
	setup({
		civInterface, ui, prettify, settings,
	} = {}) {
		this.civInterface = civInterface;
		this.ui = ui;
		this.prettify = prettify;
		this.settings = settings;
	},
	updateAll,
	updateWonderList,
	updateReset,
	updateAfterReset,
	updateTrader,
	updateRequirements,
	updatePurchaseRow,
	updateResourceRows,
	updateBuildingButtons,
	updateJobButtons,
	updatePartyButtons,
	updateResourceTotals,
	updatePopulation,
	updatePopulationBar,
	// getUnitPercent,
	updateLandBar,
	updateUpgrades,
	updateDeity,
	updateDevotion,
	addAchievementRows,
	updateAchievements,
	addRaidRows,
	updateTargets,
	updateMorale,
	addWonderSelectText,
	updateWonder,
	makeDeitiesTables,
};

export default updater;
