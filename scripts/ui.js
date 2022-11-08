/**
	CivClicker
	Copyright (C) 2016; see the README.md file for authorship.

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
*/

const TAG_DISPLAY = {
	SPAN: 'inline',
	BUTTON: 'inline-block',
	DIV: 'block',
	UL: 'block',
	OL: 'block',
	P: 'block',
	TABLE: 'table',
	CAPTION: 'table-caption',
	THEAD: 'table-header-group',
	TBODY: 'table-row-group',
	TFOOT: 'table-footer-group',
	TR: 'table-row',
	COL: 'table-column',
	TD: 'table-cell',
	LI: 'list-item',
};

const ui = {
	findAll(selector) {
		if (typeof selector === 'string') {
			return document.querySelectorAll(selector);
		}
		if (typeof selector === 'object') {
			return selector;
		}
		return undefined;
	},
	find(selector) {
		if (typeof selector === 'string') {
			/*
			if (selector.substr(0,1) === "#") {
				return document.getElementById(selector.substr(1));
			}
			*/
			return document.querySelectorAll(selector)[0];
		}
		if (typeof selector === 'object') {
			return selector;
		}
		return undefined;
	},
	isHidden(selector) {
		// NOTE: This does not work for fixed-position elements
		const elt = ui.find(selector);
		return (elt.offsetParent === null);
	},
	toggle(selector /* , force */) {
		const elt = ui.find(selector);
		if (ui.isHidden(elt)) {
			elt.style.display = 'block';
			return true;
		}
		elt.style.display = 'none';
		return false;
	},
	// Moved from jsutils.js, setElemDisplay function, and refactored ...
	// Wrapper to set an HTML element's visibility.
	// Pass the element object or ID as the 1st param.
	// Pass true as the 2nd param to be visible, false to be hidden, no value to
	// toggle.
	// Compensates for IE's lack of support for the "initial" property value.
	// May not support all HTML elements.
	// Returns the input visibility state, or undefined on an error.
	show(selector, visibleParam) {
		const elt = ui.find(selector);
		if (!elt) return undefined;
		let displayVal;
		// If the visibility is unspecified, toggle it.
		const visible = (visibleParam === undefined) ? (elt.style.display === 'none') : visibleParam;
		const tagName = elt.tagName.toUpperCase();

		/* xxx This is disabled because browser support for visibility: collapse is too inconsistent.
			// If it's a <col> element, use visibility: collapse instead.
			if (tagName == "COL") {
				elt.style.visibility = visible ? "inherit" : "collapse";
				return;
			}
		*/

		if (visible) {
			displayVal = 'initial';
			// Note that HTML comes in upper case, XML in lower.
			const tagDisplay = TAG_DISPLAY[tagName];
			if (!tagDisplay) console.warn('Unsupported tag <', tagName, '> passed to ui.show');
			else displayVal = tagDisplay;
		} else {
			displayVal = 'none';
		}
		elt.style.display = displayVal;
		return visible;
	},
	hide(selector, notVisible = true) {
		return this.show(selector, !notVisible);
	},
	body: null,
	setup() {
		// eslint-disable-next-line prefer-destructuring
		this.body = document.getElementsByTagName('body')[0];
	},
	// Interface for browser prompt and alert in case we want to make custom dialogs later
	async prompt(text, defaultText) {
		return new Promise((resolve) => {
			const ret = window.prompt(text, defaultText);
			resolve(ret);
		});
	},
	alert(text) {
		window.alert(text);
	},
};

export default ui;

if (window) {
	window.ui = ui;
	document.addEventListener('DOMContentLoaded', () => { ui.setup(); });
} else {
	console.error('ui instantiation failed');
}
