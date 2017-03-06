<!DOCTYPE html>
<!--
    CivClicker
    Copyright (C) 2014; see the AUTHORS file for authorship.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program in the LICENSE file.
    If it is not there, see <http://www.gnu.org/licenses/>.
-->
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en-gb" lang="en-gb">
<head>
    <title>CivClicker</title>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8" />
    <link rel="stylesheet" type="text/css" href="civclicker.css" />
    <link rel="canonical" href="http://civclicker.sourceforge.net/civclicker/civclicker.html" />
    <meta name="description" content="CivClicker: Build a Civilisation In Your Browser" />

    <!-- JS utilities -->
    <script type="application/javascript" src="lz-string.js" async="async"></script>
    <script type="application/javascript" src="jsutils.js" async="async"></script>
    <!-- Polyfill from https://developer.mozilla.org/en-US/docs/Web/API/Element.classList -->
    <script type="application/javascript" src="classList.js" async="async"></script>
    <!-- Main program -->
    <script type="application/javascript" src="civclicker.js" defer="defer"></script>
</head>
<body class="hasBackground">

<div id="strip">
    <div id="stripInner">
        <a href="civFAQ.html" target="_blank">FAQ / Instructions / Bugfixing</a> - 
        <a href="civUpdates.html" target="_blank">Game Updates Log</a> - 
        <a href="#" onclick="impExp()">Import/Export Save</a>
        <span id="versionAlert"> - <span id="newVersionText" onclick="location.reload()">New Version Available</span></span>
    </div>
</div>

<div id="impexp">
    <textarea id="impexpField"></textarea>
    <button id="expButton" onclick="save('export')">Export</button>
    <button id="expSelect" onclick="document.getElementById('impexpField').select();">Select All</button>
    <button id="impexpClose" onclick="impExp()">Close</button>
    <button id="impButton" onclick="load('import')">Import</button>
</div>

<div id="header">
    <h1>The <span id="civType">Thorp</span> of <span id="civName">Woodstock</span></h1>
    <div id="ruler">Ruled by the <span id="appellation">mighty</span> <span id="rulerName">Orteil</span></div>
    <div style="clear:both;"></div>
</div>

<div class="mainContent"><div id="leftColumn" class="civColumn">
    <div id="basicResourcesContainer" class="civSection">
        <h3>Basic Resources</h3>
        <table id="basicResources"></table>
    </div>
    <div id="specialResourcesContainer" class="civSection">
        <h3>Special Resources</h3>
        <table>
            <tr>
                <td>Skins: </td>
                <td class="number"><span data-action="display" data-target="skins">0</span></td>
                <td><img src="images/skins.png" class="icon icon-lg" alt="Skins"/></td>
                <td>Leather: </td>
                <td class="number"><span data-action="display" data-target="leather">0</span></td>
                <td class="icon"><img src="images/leather.png" class="icon icon-lg" alt="Leather"/></td>
            </tr>
            <tr>
                <td>Herbs: </td>
                <td class="number"><span data-action="display" data-target="herbs">0</span></td>
                <td><img src="images/herbs.png" class="icon icon-lg" alt="Herbs"/></td>
                <td>Piety: </td>
                <td class="number"><span data-action="display" data-target="piety">0</span></td>
                <td class="icon"><img src="images/piety.png" class="icon icon-lg" alt="Piety"/></td>
            </tr>
            <tr>
                <td>Ore: </td>
                <td class="number"><span data-action="display" data-target="ore">0</span></td>
                <td><img src="images/ore.png" class="icon icon-lg" alt="Ore"/></td>
                <td>Metal: </td>
                <td class="number"><span data-action="display" data-target="metal">0</span></td>
                <td class="icon"><img src="images/metal.png" class="icon icon-lg" alt="Metal"/></td>
            </tr>
            <tr id="goldRow">
                <td>Gold: </td>
                <td class="number"><span data-action="display" data-target="gold">0</span></td>
                <td class="icon"><img src="images/gold.png" class="icon icon-lg" alt="Gold"/></td>
                <td colspan="3"></td>
            </tr>
        </table>
    </div>
    <div id="panesSelectors" class="civSection">
        <div id="selectors">
            <div id="buildingsSelect" class="paneSelector selected" data-target="buildingsPane" onclick="paneSelect(this)">Buildings</div>
            <div id="upgradesSelect" class="paneSelector" data-target="upgradesPane" onclick="paneSelect(this)">Upgrades</div>
            <div id="deitySelect" class="paneSelector" data-target="deityPane" onclick="paneSelect(this)">Deity</div>
            <div id="conquestSelect" class="paneSelector" data-target="conquestPane" onclick="paneSelect(this)">Conquest</div>
            <div id="tradeSelect" class="paneSelector" data-target="tradePane" onclick="paneSelect(this)">Trade</div>
            <div id="achievementsSelect" class="paneSelector" data-target="achievementsPane" onclick="paneSelect(this)">Achievements</div>
            <div id="settingsSelect" class="paneSelector" data-target="settingsPane" onclick="paneSelect(this)">Settings</div>
            <div style="clear:both;"></div>
        </div>
        
        <div id="buildingsPane" class="selectPane selected">
            <p id="customBuildQuantity">
                Custom Quantity <input id="buildingCustomQty" type="number" min="1" step="1" value="1" />
            </p>
            <table id="buildings"></table>
        </div>
        
        <div id="upgradesPane" class="selectPane">
            <table id="upgrades"></table>
        </div>
        
        <div id="deityPane" class="selectPane">
            <span id="worshipRow"></span>
            <div id="deityDomains">
                <span id="battleRow" class="purchaseRow" data-target="battle"> <span class="upgradetrue" data-quantity="true">
                <button id="battleDeity" class="xtrue" onmousedown="selectDeity('battle')">Battle</button></span>
                <span><span id="battleCost" class="cost">500 piety</span><span id="battleNote" class="note">: (You can only pick one of these)</span></span><br /></span>
                <span id="fieldsRow" class="purchaseRow" data-target="fields"> <span class="upgradetrue" data-quantity="true">
                <button id="fieldsDeity" class="xtrue" onmousedown="selectDeity('fields')">Fields</button></span>
                <span><span id="fieldsCost" class="cost">500 piety</span><span id="fieldsNote" class="note">: (You can only pick one of these)</span></span><br /></span>
                <span id="underworldRow" class="purchaseRow" data-target="underworld"> <span class="upgradetrue" data-quantity="true">
                <button id="underworldDeity" class="xtrue" onmousedown="selectDeity('underworld')">Underworld</button></span>
                <span><span id="underworldCost" class="cost">500 piety</span><span id="underworldNote" class="note">: (You can only pick one of these)</span></span><br /></span>
                <span id="catsRow" class="purchaseRow" data-target="cats"> <span class="upgradetrue" data-quantity="true">
                <button id="catsDeity" class="xtrue" onmousedown="selectDeity('cats')">Cats</button></span>
                <span><span id="catsCost" class="cost">500 piety</span><span id="catsNote" class="note">: (You can only pick one of these)</span></span><br /></span>
            </div>
            <div id="battleUpgrades">
                <h3>The Strength of Battle</h3>
                <table>
                    <tr id="battleAltarRow"><td></td></tr>
                    <tr id="riddleRow"><td></td></tr>
                    <tr id="smiteRow"><td></td></tr>
                    <tr id="throneRow"><td></td></tr>
                    <tr id="gloryRow"><td></td></tr>
                    <tr id="lamentRow"><td></td></tr>
                </table>
            </div>
            <div id="fieldsUpgrades">
                <h3>The Bounty of the Fields</h3>
                <table>
                    <tr id="fieldsAltarRow"><td></td></tr>
                    <tr id="blessingRow"><td></td></tr>
                    <tr id="wickermanRow"><td></td></tr>
                    <tr id="wasteRow"><td></td></tr>
                    <tr id="walkRow"><td></td></tr>
                    <tr id="stayRow"><td></td></tr>
                </table>
            </div>
            <div id="underworldUpgrades">
                <h3>The Dread Power of the Underworld</h3>
                <table>
                    <tr id="underworldAltarRow"><td></td></tr>
                    <tr id="bookRow"><td></td></tr>
                    <tr id="raiseDeadRow"><td></td></tr>
                    <tr id="feastRow"><td></td></tr>
                    <tr id="summonShadeRow"><td></td></tr>
                    <tr id="secretsRow"><td></td></tr>
                </table>
            </div>
            <div id="catsUpgrades">
                <h3>The Grace of Cats</h3>
                <table>
                    <tr id="catAltarRow"><td></td></tr>
                    <tr id="lureRow"><td></td></tr>
                    <tr id="pestControlRow"><td></td></tr>
                    <tr id="companionRow"><td></td></tr>
                    <tr id="graceRow"><td></td></tr>
                    <tr id="comfortRow"><td></td></tr>
                </table>
            </div>
            <div id="pantheonContainer">
                <h3>Pantheon</h3>
                <table id="oldDeities"><tr><td></td></tr></table>
            </div>
            <div id="iconoclasmGroup">
                <button id="iconoclasm" onmousedown="iconoclasmList()">Iconoclasm</button>
				<span id="iconoclasmCost" class="cost">1,000 piety</span>
				<span id="iconoclasmNote" class="note">: Remove an old deity to gain gold</span><br />
                <div id="iconoclasmList"></div>
            </div>
            <div id="permaUpgradeContainer">
                <h3>Pantheon Upgrades</h3>
                <div id="purchasedPantheon"></div>
            </div>
        </div>
        <div id="conquestPane" class="selectPane">
            <span id="standardRow"></span>
            <div id="conquest">
                <h4>Army</h4>
                <p id="customPartyQuantity">
                    Custom Quantity <input id="partyCustomQty" type="number" min="1" step="1" value="1" />
                </p>
                <table id="party"></table>
                <br />
                <div id="raidGroup">
                    <h4>To War!</h4>
                    <p id="gloryGroup">
                        Glory: <span id="gloryTimer">0</span> seconds remain
                    </p>
                </div>
                <div id="victoryGroup">
                    <h4>Victory!</h4>
                    <button id="plunder" onmousedown="plunder()">Plunder Resources</button><br />
                </div>
            </div>
        </div>
        <div id="tradePane" class="selectPane">
            <span id="tradeRow"></span>
            <div id="tradeUpgradeContainer">
                <span id="currencyRow"></span>
                <span id="commerceRow"></span>
                <h4>Buy Resources (1 gold)</h4>
                <button class="tradeResource" onmousedown="buy('food')">Buy 5000 Food</button><br />
                <button class="tradeResource" onmousedown="buy('wood')">Buy 5000 Wood</button><br />
                <button class="tradeResource" onmousedown="buy('stone')">Buy 5000 Stone</button><br />
                <button class="tradeResource" onmousedown="buy('skins')">Buy 500 Skins</button><br />
                <button class="tradeResource" onmousedown="buy('herbs')">Buy 500 Herbs</button><br />
                <button class="tradeResource" onmousedown="buy('ore')">Buy 500 Ore</button><br />
                <button class="tradeResource" onmousedown="buy('leather')">Buy 250 Leather</button><br />
                <button class="tradeResource" onmousedown="buy('metal')">Buy 250 Metal</button><br />
            </div>
        </div>
        <div id="achievementsPane" class="selectPane">
            <div id="achievements">
                <h3>Achievements</h3>
            </div>
        </div>
        <div id="settingsPane" class="selectPane">
            <div id="settings">
                <h3>Settings</h3>
                <button onmousedown="save('manual')" title="Save your current stats">Manual Save</button><br />
                <label><input id="toggleAutosave" type="checkbox" onclick="onToggleAutosave(this)" title="Autosave"/>Autosave</label><br />
                <button onmousedown="reset()" title="Reset your game">Reset Game</button><span class="note"><span id="resetNote"><br/>Resetting allows you to </span><span id="resetDeity">gain another deity</span><span id="resetBoth"><br/> and </span><span id="resetWonder">build another Wonder</span></span><br />
                <br />
                <button onmousedown="deleteSave()" title="Delete your saved stats">Delete Save File</button><br />
                <br />
                <button onmousedown="renameCiv()" title="Rename your civilisation">Rename Civilisation</button><br />
                <button id="renameRuler" onmousedown="renameRuler()" title="Rename yourself">Rename Yourself</button><br />
                <button id="renameDeity" onmousedown="renameDeity()" title="Rename your deity" disabled="disabled">Rename Current Deity</button><br />
                <br />
                <span id="textSize"><button id="smallerText" onmousedown="textSize(-1)" title="Smaller Text">&minus;</button>Text Size
                <button id="largerText" onmousedown="textSize(1)" title="Larger Text">+</button></span><br />
                <br />
                <label><input id="toggleCustomQuantities" type="checkbox" onclick="onToggleCustomQuantities(this)" title="Custom Quantity"/>Use Custom Quantities</label><br />
                <label><input id="toggleDelimiters" type="checkbox" onclick="onToggleDelimiters(this)" title="Toggle Delimiters"/>Number Delimiters</label><br />
                <label><input id="toggleShadow" type="checkbox" onclick="onToggleShadow(this)" title="Toggle Text Shadow"/>Text Shadows</label><br />
                <label><input id="toggleNotes" type="checkbox" onclick="onToggleNotes(this)" title="Toggle Notes"/>Show Notes</label><br />
                <label><input id="toggleWorksafe" type="checkbox" onclick="onToggleWorksafe(this)" title="Toggle Worksafe Mode"/>Worksafe Mode</label><br />
                <label><input id="toggleIcons" type="checkbox" onclick="onToggleIcons(this)" title="Toggle Icons"/>Use Icons</label><br />
            </div>
        </div>
    </div>
    </div><div id="rightColumn" class="civColumn">
    <div id="populationContainer" class="civSection">
        <h3>Population</h3>
        <div id="populationNumbers">
            <table>
                <tr>
                    <td>Current Population: </td>
                    <td class="number"><span data-action="display_pop" data-target="current">0</span></td>
                </tr>
                <tr>
                    <td>Maximum Population: </td>
                    <td class="number"><span data-action="display_pop" data-target="limit">0</span></td>
                </tr>
                <tr id="zombieWorkers">
                    <td>Zombies: </td>
                    <td class="number"><span data-action="display" data-target="zombie">0</span></td>
                </tr>
                <tr>
                    <td>Happiness: </td>
                    <td><span id="morale">Content</span></td>
                </tr>
            </table>
            <br />
        </div>
        <div id="populationCreate">
            <div class="unit1"><button id="spawn1button" onmousedown="spawn(1)" disabled="disabled">Recruit Worker</button><span class="cost"><span id="workerCost">20</span> food</span><span class="note">: Recruit a new worker</span><br /></div>
            <div class='unit10'><button id="spawn10button" onmousedown="spawn(10)">Recruit 10 Workers</button><span class="cost"><span id="workerCost10">200</span> food</span><span class="note">: Recruit 10 new workers</span></div>
            <div class='unit100'><button id="spawn100button" onmousedown="spawn(100)">Recruit 100 Workers</button><span class="cost"><span id="workerCost100">2000</span> food</span><span class="note">: Recruit 100 new workers</span></div>
            <div class='unit1000'><button id="spawn1000button" onmousedown="spawn(1000)">Recruit 1000 Workers</button><span class="cost"><span id="workerCost1000">20000</span> food</span><span class="note">: Recruit 1000 new workers</span></div>
            <div class='unitInfinity'><button id="spawnMaxbutton" onmousedown="spawn(Infinity)">Recruit <span id="workerNumMax">Max</span> Workers</button><span class="cost"><span id="workerCostMax"></span> food</span><span class="note">: Recruit as many new workers as possible</span></div>
            <div id="customSpawnQuantity"><button id="spawnCustomButton" onmousedown="spawn('custom')">Recruit Workers</button><input id="spawnCustomQty" type="number" min="1" step="1" value="1" />
            </div>
        </div>
    </div>
    <div id="jobsContainer" class="civSection">
        <h3>Jobs</h3>
        <p id="customJobQuantity">
            Custom Quantity <input id="homeCustomQty" type="number" min="1" step="1" value="1" />
        </p>
        <table id="jobs"></table>
    </div>
    <div id="tradeContainer">
        Trader offers 1 gold for <span id="tradeRequested">0</span> <span id="tradeType">food</span><br />
        <button id="trader" onmousedown="trade()">Trade</button>
    </div>
    <div id="eventsContainer" class="civSection">
        <h3>Events</h3>
        <table id="logTable">
            <tr id="log0"><td id="logT"></td><td id="logL"></td><td id="logR"></td></tr>
            <tr id="log1"><td colspan="3"></td></tr>
            <tr id="log2"><td colspan="3"></td></tr>
            <tr id="log3"><td colspan="3"></td></tr>
            <tr id="log4"><td colspan="3"></td></tr>
            <!-- <tr id="log5"><td colspan="3"></td></tr>
            <tr id="log6"><td colspan="3"></td></tr>
            <tr id="log7"><td colspan="3"></td></tr>
            <tr id="log8"><td colspan="3"></td></tr>
            <tr id="log9"><td colspan="3"></td></tr> -->
        </table>
    </div>
    <div id="deityContainer" class="civSection">
        <h3>Current Deity</h3>
        <table id="activeDeity"><tr><td></td></tr></table>
    </div>
    <div id="wondersContainer" class="civSection">
        <h3>Wonders</h3>
        <span id="startWonderLine"><button id="startWonder" onmousedown="startWonder()">Start Building Wonder</button></span>
        <div id="wonderInProgress">
            <span class="wonderTitle">Progress on <span id="wonderNameP">Wonder</span> - <span id="progressNumber">0</span>%</span> - <button id="renameWonder" onmousedown="renameWonder()">Rename</button>
            <div id="progressContainer"><div id="progressBar"></div></div>
            <div id="lowResources">Limited<span id="limited"> by low resources</span></div>
            <div id="speedWonderGroup"><br /><button id="speedWonder" onmousedown="speedWonder()">Speed Wonder</button>
            <span id="speedWonderCost" class="cost">100 gold</span><span class="note">: Increase wonder progress</span></div>
        </div>
        <div id="wonderCompleted">
            <div class="wonderTitle"><span id="wonderNameC">Wonder</span> Completed! Choose Bonus:</div>
        </div>
        <table id="pastWonders"><tr><td></td></tr></table>
    </div>
    <div id="statsContainer" class="civSection">
        <h3>Stats</h3>
        Resource clicks: <span id="clicks">0</span><br />
        Total Land: <span id="totalLand">1000</span><br />
        Total Buildings: <span id="totalBuildings">0</span><br />
        Enemies Slain: <span data-action="display" data-target="enemySlain">0</span><br />
        Unburied Corpses: <span data-action="display" data-target="corpses">0</span><br />
        <span id="graveTotal">Unfilled Graves: <span data-action="display" data-target="grave">0</span><br /></span>
        <span id="walkGroup"><br />Walk: <span id="walkStat">0</span> workers per second<br /></span>
    </div>
</div></div>
</body>
</html>
