// Update functions. Called by other routines in order to update the interface.

function updateAll () {
	updateTrader();
	updateUpgrades();
	updateResourceRows(); //Update resource display
	updateBuildingButtons();
	updateJobButtons();
	updatePartyButtons();
	updatePopulation();
	updateTargets();
	updateDevotion();
	updateWonder();
	updateReset();	
};

function updateWonderList(){
	if (curCiv.wonders.length === 0) { return; }

	var i;
	//update wonder list
	var wonderhtml = "<tr><td><strong>Name</strong></td><td><strong>Type</strong></td></tr>";
	for (i=(curCiv.wonders.length - 1); i >= 0; --i){
		try {
			wonderhtml += "<tr><td>"+curCiv.wonders[i].name+"</td><td>"+curCiv.wonders[i].resourceId+"</td></tr>";
		} catch(err) {
			console.log("Could not build wonder row " + i);
		}
	}
	ui.find("#pastWonders").innerHTML = wonderhtml;
}

function updateReset(){
	ui.show("#resetNote"  , (civData.worship.owned || curCiv.curWonder.stage === 3));
	ui.show("#resetDeity" , (civData.worship.owned));
	ui.show("#resetWonder", (curCiv.curWonder.stage === 3));
	ui.show("#resetBoth"  , (civData.worship.owned && curCiv.curWonder.stage === 3));
}

function updateAfterReset () {
	updateRequirements(civData.mill);
	updateRequirements(civData.fortification);
	updateRequirements(civData.battleAltar);
	updateRequirements(civData.fieldsAltar);
	updateRequirements(civData.underworldAltar);
	updateRequirements(civData.catAltar);

	ui.find("#graceCost").innerHTML = prettify(civData.grace.cost);
	//Update page with all new values
	updateResourceTotals();
	updateUpgrades();
	updateDeity();
	makeDeitiesTables();
	updateDevotion();
	updateTargets();
	updateJobButtons();
	updatePartyButtons();
	updateWonder();
	//Reset upgrades and other interface elements that might have been unlocked
	//xxx Some of this probably isn't needed anymore; the update routines will handle it.
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

function updateTrader () {
	var isHere = isTraderHere();
	if (isHere) {
		ui.find("#tradeType").innerHTML = civData[curCiv.trader.materialId].getQtyName(curCiv.trader.requested);
		ui.find("#tradeRequested").innerHTML = prettify(curCiv.trader.requested);
		ui.find("#traderTimer").innerHTML = curCiv.trader.timer + " second" + ((curCiv.trader.timer != 1) ? "s" : "");
	} else {
		
	}
	ui.show("#tradeContainer", isHere);
	ui.show("#noTrader", !isHere);
	ui.show("#tradeSelect .alert", isHere);
	return isHere;
}

//xxx This should become an onGain() member method of the building classes
function updateRequirements(buildingObj){
	var displayNode = document.getElementById(buildingObj.id + "Cost");
	if (displayNode) { displayNode.innerHTML = getReqText(buildingObj.require); }
}

function updatePurchaseRow (purchaseObj) {
	if (!purchaseObj) { return; }

	var elem = ui.find("#" + purchaseObj.id + "Row");
	if (!elem) { console.warn("Missing UI element for "+purchaseObj.id); return; }

	// If the item's cost is variable, update its requirements.
	if (purchaseObj.hasVariableCost()) { updateRequirements(purchaseObj); }

	// Already having one reveals it as though we met the prereq.
	var havePrereqs = (purchaseObj.owned > 0) || meetsPrereqs(purchaseObj.prereqs);

	// Special check: Hide one-shot upgrades after purchase; they're
	// redisplayed elsewhere.
	var hideBoughtUpgrade = ((purchaseObj.type == "upgrade") && (purchaseObj.owned == purchaseObj.limit) && !purchaseObj.salable);

	var maxQty = canPurchase(purchaseObj);
	var minQty = canPurchase(purchaseObj,-Infinity);

	var buyElems = elem.querySelectorAll("[data-action='purchase']");

	buyElems.forEach(function(elt){
		var purchaseQty = dataset(elt, "quantity");
		// Treat 'custom' or Infinity as +/-1.
		//xxx Should we treat 'custom' as its appropriate value instead?
		var absQty = abs(purchaseQty);
		if ((absQty == "custom") || (absQty == Infinity)) { 
			purchaseQty = sgn(purchaseQty); 
		}
		elt.disabled = ((purchaseQty > maxQty) || (purchaseQty < minQty));
	});

	// Reveal the row if  prereqs are met
	ui.show(elem, havePrereqs && !hideBoughtUpgrade);
}


// Only set up for the basic resources right now.
function updateResourceRows() { 
	basicResources.forEach(function(elem) { updatePurchaseRow(elem); }); 
}
// Enables/disabled building buttons - calls each type of building in turn
// Can't do altars; they're not in the proper format.
function updateBuildingButtons() { 
	homeBuildings.forEach(function(elem) { updatePurchaseRow(elem); }); 
}
// Update the page with the latest worker distribution and stats
function updateJobButtons(){ 
	homeUnits.forEach(function(elem) { updatePurchaseRow(elem); }); 
}
// Updates the party (and enemies)
function updatePartyButtons(){ 
	armyUnits.forEach(function(elem) { updatePurchaseRow(elem); }); 
}


//xxx Maybe add a function here to look in various locations for vars, so it
//doesn't need multiple action types?
function updateResourceTotals(){
	var i,displayElems,elem,val;
	var landTotals = getLandTotals();

	// Scan the HTML document for elements with a "data-action" element of
	// "display".  The "data-target" of such elements (or their ancestors) 
	// is presumed to contain
	// the global variable name to be displayed as the element's content.
	//xxx Note that this is now also updating nearly all updatable values,
	// including population
	displayElems = document.querySelectorAll("[data-action='display']");
	for (i=0;i<displayElems.length;++i)
	{
		elem = displayElems[i];
		//xxx Have to use curCiv here because of zombies and other non-civData displays.
		elem.innerHTML = prettify(Math.floor(curCiv[dataset(elem,"target")].owned));
	}

	// Update net production values for primary resources.  Same as the above,
	// but look for "data-action" == "displayNet".
	displayElems = document.querySelectorAll("[data-action='displayNet']");
	for (i=0;i<displayElems.length;++i)
	{
		elem = displayElems[i];
		val = civData[dataset(elem,"target")].net;
		if (!isValid(val)) { continue; }

		// Colourise net production values.
		if      (val < 0) { elem.style.color="#f00"; }
		else if (val > 0) { elem.style.color="#0b0"; }
		else              { elem.style.color="#000"; }

		elem.innerHTML = ((val < 0) ? "" : "+") + prettify(val.toFixed(1));
	}


	//if (civData.gold.owned >= 1){
	//	ui.show("#goldRow",true);
	//}

	//Update page with building numbers, also stockpile limits.
	ui.find("#maxfood").innerHTML = prettify(civData.food.limit);
	ui.find("#maxwood").innerHTML = prettify(civData.wood.limit);
	ui.find("#maxstone").innerHTML = prettify(civData.stone.limit);
	ui.find("#totalBuildings").innerHTML = prettify(landTotals.buildings);
	ui.find("#totalLand"     ).innerHTML = prettify(landTotals.lands);

	// Unlock advanced control tabs as they become enabled (they never disable)
	// Temples unlock Deity, barracks unlock Conquest, having gold unlocks Trade.
	// Deity is also unlocked if there are any prior deities present.
	if ((civData.temple.owned > 0)||(curCiv.deities.length > 1)) { ui.show("#deitySelect",true); }
	if (civData.barracks.owned > 0) { ui.show("#conquestSelect",true); }
	if (civData.gold.owned > 0) { ui.show("#tradeSelect",true); }

	// Need to have enough resources to trade
	ui.find("#tradeButton").disabled = !curCiv.trader || !curCiv.trader.timer ||
		(civData[curCiv.trader.materialId].owned < curCiv.trader.requested);

	// Cheaters don't get names.
	ui.find("#renameRuler").disabled = (curCiv.rulerName == "Cheater");
}

//Update page with numbers
function updatePopulation (calc) {
	var i, elem, elems, displayElems,
		spawn1button = ui.find("#spawn1button"),
		spawnCustomButton = ui.find("#spawnCustomButton"),
		spawnMaxbutton = ui.find("#spawnMaxbutton"),
		spawn10button = ui.find("#spawn10button"),
		spawn100button = ui.find("#spawn100button"),
		spawn1000button = ui.find("#spawn1000button");

	if (calc) { calculatePopulation(); }

	// Scan the HTML document for elements with a "data-action" element of
	// "display_pop".  The "data-target" of such elements is presumed to contain
	// the population subproperty to be displayed as the element's content.
	//xxx This selector should probably require data-target too.
	//xxx Note that relatively few values are still stored in the population
	// struct; most of them are now updated by the 'display' action run
	// by updateResourceTotals().
	displayElems = document.querySelectorAll("[data-action='display_pop']");
	displayElems.forEach(function(elt){
		var prop = dataset(elt, "target");
		elt.innerHTML = prettify(Math.floor(population[prop]));
	});

	civData.house.update(); // TODO: Effect might change dynamically.  Need a more general way to do this.
	civData.barn.update();

	ui.show("#graveTotal", (curCiv.grave.owned > 0));
	ui.show("#totalSickRow",(population.totalSick > 0));

	//As population increases, various things change
	// Update our civ type name
	ui.find("#civType").innerHTML = getCivType();

	//Unlocking interface elements as population increases to reduce unnecessary clicking
	//xxx These should be reset in reset()
	if (population.current >= 10) {
		if (!settings.customIncr){    
			elems = document.getElementsByClassName("unit10");
			for(i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
		}
	}
	if (population.current >= 100) {
		if (!settings.customIncr){
			elems = document.getElementsByClassName("building10");
			for(i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
			elems = document.getElementsByClassName("unit100");
			for(i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
		}
	}
	if (population.current >= 1000) {
		if (!settings.customIncr){
			elems = document.getElementsByClassName("building100");
			for(i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
			elems = document.getElementsByClassName("unit1000");
			for(i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
			elems = document.getElementsByClassName("unitInfinity");
			for(i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
		}
	}
	if (population.current >= 10000) {
		if (!settings.customIncr){
			elems = document.getElementsByClassName("building1000");
			for(i = 0; i < elems.length; i++) {
				ui.show(elems[i], !settings.customincr);
			}
		}
	}

	//Turning on/off buttons based on free space.
	var maxSpawn = Math.max(0,Math.min((population.limit - population.living),logSearchFn(calcWorkerCost,civData.food.owned)));

	spawn1button.disabled = (maxSpawn < 1);
	spawnCustomButton.disabled = (maxSpawn < 1);
	spawnMaxbutton.disabled = (maxSpawn < 1);
	spawn10button.disabled = (maxSpawn < 10);
	spawn100button.disabled = (maxSpawn < 100);
	spawn1000button.disabled = (maxSpawn < 1000);

	var canRaise = (getCurDeityDomain() == "underworld" && civData.devotion.owned >= 20);
	var maxRaise = canRaise ? logSearchFn(calcZombieCost,civData.piety.owned) : 0;
	ui.show("#raiseDeadRow", canRaise);
	ui.find("#raiseDead").disabled = (maxRaise < 1);
	ui.find("#raiseDeadMax").disabled = (maxRaise < 1);
	ui.find("#raiseDead100").disabled = (maxRaise < 100);

	//Calculates and displays the cost of buying workers at the current population
	ui.find("#raiseDeadCost").innerHTML = prettify(Math.round(calcZombieCost(1)));

	ui.find("#workerNumMax").innerHTML = prettify(Math.round(maxSpawn));

	spawn1button.title = "Cost: " + prettify(Math.round(calcWorkerCost(1))) + " food";
	spawn10button.title = "Cost: " + prettify(Math.round(calcWorkerCost(10))) + " food";
	spawn100button.title = "Cost: " + prettify(Math.round(calcWorkerCost(100))) + " food";
	spawn1000button.title = "Cost: " + prettify(Math.round(calcWorkerCost(1000))) + " food";
	spawnMaxbutton.title = "Cost: " + prettify(Math.round(calcWorkerCost(maxSpawn))) + " food";

	ui.find("#workerCost").innerHTML = prettify(Math.round(calcWorkerCost(1)));

	updateJobButtons(); //handles the display of units in the player's kingdom.
	updatePartyButtons(); // handles the display of units out on raids.
	updateMorale();
	updateAchievements(); //handles display of achievements
	updatePopulationBar();
	updateLandBar();
}

function updatePopulationBar () {
	var barElt = ui.find("#populationBar");
	var h = '';
	function getUnitPercent (x, y) {
		return (Math.floor(100000 * (x / y)) / 1000);
	}
	unitData.forEach(function(unit){
		var p;
		if (unit.isPopulation) {
			p = getUnitPercent(unit.owned, population.current);
			h += (
				'<div class="' + unit.id + '" '
				+ ' style="width: ' + p + '%">'
				+ '<span>' + (Math.round(p * 10)/10) + '% ' + unit.plural + '</span>'
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

function updateLandBar () {
	var barElt = ui.find("#landBar");
	var landTotals = getLandTotals();
	var p = (Math.floor(1000 * (landTotals.buildings / landTotals.lands)) / 10);
	barElt.innerHTML = ('<div style="width: ' + p + '%"></div>');	
}


// Check to see if the player has an upgrade and hide as necessary
// Check also to see if the player can afford an upgrade and enable/disable as necessary
function updateUpgrades(){
	var domain = getCurDeityDomain();
	var hasDomain = (getCurDeityDomain() === "") ? false : true;
	var canSelectDomain = ((civData.worship.owned) && !hasDomain);

	// Update all of the upgrades
	upgradeData.forEach( function(elem){ 
		updatePurchaseRow(elem);  // Update the purchase row.

		// Show the already-purchased line if we've already bought it.
		ui.show(("#P" + elem.id), elem.owned);
	});

	// Deity techs
	ui.show("#deityPane .notYet", (!hasDomain && !canSelectDomain));
	ui.find("#renameDeity").disabled = (!civData.worship.owned);
	ui.show("#battleUpgrades", (getCurDeityDomain() == "battle"));
	ui.show("#fieldsUpgrades", (getCurDeityDomain() == "fields"));
	ui.show("#underworldUpgrades", (getCurDeityDomain() == "underworld"));
	ui.show("#zombieWorkers", (curCiv.zombie.owned > 0));
	ui.show("#catsUpgrades", (getCurDeityDomain() == "cats"));

	ui.show("#deityDomains", canSelectDomain);
	ui.findAll("#deityDomains button.purchaseFor500Piety").forEach(function(button){
		button.disabled = (!canSelectDomain || (civData.piety.owned < 500));
	});
	//ui.show("#deitySelect .alert", canSelectDomain);

	ui.show("#" + domain + "Upgrades", hasDomain);

	// Conquest / battle standard
	ui.show("#conquest", civData.standard.owned);
	ui.show("#conquestPane .notYet", (!civData.standard.owned));

	// Trade
	ui.show("#tradeUpgradeContainer", civData.trade.owned);
	ui.show("#tradePane .notYet", !civData.trade.owned);
}


function updateDeity(){
	var hasDeity = (curCiv.deities[0].name) ? true : false;
	//Update page with deity details
	ui.find("#deityAName").innerHTML = curCiv.deities[0].name;
	ui.find("#deityADomain").innerHTML = getCurDeityDomain() ? ", deity of "+idToType(getCurDeityDomain()) : "";
	ui.find("#deityADevotion").innerHTML = civData.devotion.owned;

	// Display if we have an active deity, or any old ones.
	ui.show("#deityContainer", hasDeity);
	ui.show("#activeDeity", hasDeity);
	ui.show("#oldDeities", (hasDeity || curCiv.deities.length > 1));
	ui.show("#pantheonContainer", (hasDeity || curCiv.deities.length > 1));
	ui.show("#iconoclasmGroup", (curCiv.deities.length > 1));
}

// Enables or disables availability of activated religious powers.
// Passive religious benefits are handled by the upgrade system.
function updateDevotion(){
	ui.find("#deityA"+"Devotion").innerHTML = civData.devotion.owned;

	// Process altars
	buildingData.forEach(function(elem) { if (elem.subType == "altar") {
		ui.show(("#" + elem.id + "Row"), meetsPrereqs(elem.prereqs));
		document.getElementById(elem.id).disabled = (!(meetsPrereqs(elem.prereqs) && canAfford(elem.require)));
	}});

	// Process activated powers
	powerData.forEach(function(elem) { if (elem.subType == "prayer") {
		//xxx raiseDead buttons updated by UpdatePopulationUI
		if (elem.id == "raiseDead") { return; }
		ui.show(("#" + elem.id + "Row"), meetsPrereqs(elem.prereqs));
		document.getElementById(elem.id).disabled = !(meetsPrereqs(elem.prereqs) && canAfford(elem.require));
	}});

	//xxx Smite should also be disabled if there are no foes.

	//xxx These costs are not yet handled by canAfford().
	if (population.healthy < 1) { 
		ui.find("#wickerman").disabled = true; 
		ui.find("#walk").disabled = true; 
	}

	ui.find("#ceaseWalk").disabled = (civData.walk.rate === 0);
}

// Dynamically create the achievement display
function addAchievementRows()
{
	var s = '';
	achData.forEach(function(elem) { 
		s += (
			'<div class="achievement" title="' + elem.getQtyName() + '">'
			+ '<div class="unlockedAch" id="' + elem.id + '">' + elem.getQtyName() + '</div>'
			+ '</div>'
		)
	});
	ui.find("#achievements").innerHTML += s;
}

// Displays achievements if they are unlocked
function updateAchievements(){
	achData.forEach(function(achObj) { 
		ui.show("#" + achObj.id, achObj.owned);
	});
}


// Dynamically add the raid buttons for the various civ sizes.
function addRaidRows()
{
	var s = '';
	civSizes.forEach(function(elem) { 
		s += "<button class='raid' data-action='raid' data-target='"+elem.id+"' disabled='disabled'>"+
		"Raid "+elem.name+"</button>"; //xxxL10N
	});

	var group = ui.find("#raidGroup");
	group.innerHTML += s;
	group.onmousedown = onBulkEvent;
}

// Enable the raid buttons for eligible targets.
function updateTargets(){
	var i;
	var raidButtons = document.getElementsByClassName("raid");
	var haveArmy = false;

	ui.show("#victoryGroup", curCiv.raid.victory);

	// Raid buttons are only visible when not already raiding.
	if (ui.show("#raidGroup", !curCiv.raid.raiding))
	{
		if (getCombatants("party", "player").length > 0) { haveArmy = true; }

		var curElem;
		for(i=0;i<raidButtons.length;++i)
		{
			// Disable if we have no standard, no army, or they are too big a target.
			curElem = raidButtons[i];
			curElem.disabled = (!civData.standard.owned||!haveArmy || (civSizes[dataset(curElem,"target")].idx > civSizes[curCiv.raid.targetMax].idx));
		}
	}
}

function updateMorale(){
	//updates the morale stat
	var happinessRank; // Lower is better
	var elt = ui.find("#morale");
	//first check there's someone to be happy or unhappy, not including zombies
	if (population.living < 1) { 
		elt.className = "";
		return;
	}

	if (curCiv.morale.efficiency > 1.4) { 		happinessRank = 1; }
	else if (curCiv.morale.efficiency > 1.2) { 	happinessRank = 2;    }
	else if (curCiv.morale.efficiency > 0.8) { 	happinessRank = 3;  }
	else if (curCiv.morale.efficiency > 0.6) { 	happinessRank = 4;  }
	else                              { 		happinessRank = 5;    }

	elt.className = "happy-" + happinessRank;
}

function addWonderSelectText() {
	var wcElem = ui.find("#wonderCompleted");
	if (!wcElem) { console.log("Error: No wonderCompleted element found."); return; }
	var s = wcElem.innerHTML;
	wonderResources.forEach(function(elem,i, wr) {
		s += "<button onmousedown='wonderSelect(\"" +elem.id+"\")'>"+elem.getQtyName(0)+"</button>";
		// Add newlines to group by threes (but no newline for the last one)
		if (!((i+1)%3) && (i != wr.length - 1)) { s += "<br />"; }
	});
	
	wcElem.innerHTML = s;
}

//updates the display of wonders and wonder building
function updateWonder () {
	var haveTech = (civData.architecture.owned && civData.civilservice.owned);
	var isLimited = isWonderLimited();
	var lowItem = getWonderLowItem();
	
	ui.show("#lowResources", isLimited);
	ui.show("#upgradesSelect .alert", isLimited);

	if (lowItem) { 
		ui.find("#limited").innerHTML = " by low " + lowItem.getQtyName(); 
	}

	if (curCiv.curWonder.progress >= 100) {
		ui.find("#lowResources").style.display = "none";
	}

	// Display this section if we have any wonders or could build one.
	ui.show("#wondersContainer",(haveTech || curCiv.wonders.length > 0));

	// Can start building a wonder, but haven't yet.
	ui.show("#startWonderLine",(haveTech && curCiv.curWonder.stage === 0 ));
	ui.find("#startWonder").disabled = (!haveTech || curCiv.curWonder.stage !== 0); 

	// Construction in progress; show/hide building area and labourers
	ui.show("#labourerRow",(curCiv.curWonder.stage === 1));
	ui.show("#wonderInProgress",(curCiv.curWonder.stage === 1));
	ui.show("#speedWonderGroup",(curCiv.curWonder.stage === 1));
	ui.find("#speedWonder").disabled = (curCiv.curWonder.stage !== 1 || !canAfford({ gold: 100 }));
	if (curCiv.curWonder.stage === 1){
		ui.find("#progressBar").style.width = curCiv.curWonder.progress.toFixed(2) + "%";
		ui.find("#progressNumber").innerHTML = curCiv.curWonder.progress.toFixed(2);
	}

	// Finished, but haven't picked the resource yet.
	ui.show("#wonderCompleted",(curCiv.curWonder.stage === 2));
 
	updateWonderList();
}