"use strict";
/**
    CivClicker
    Copyright (C) 2014; see the README.md file for authorship.

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
**/

function isValid(variable) {
    return ((variable !== null) &&
            (variable !== undefined) &&
            (variable === variable)); // This is a way to test for NaN that
            // isn't subject to the unexpected behavior of isNaN().
}

// Returns the variable if it's valid, otherwise the default value (or "")
function ifValid(variable, defVal) {
    if (defVal === undefined) { defVal = ""; }
    return isValid(variable) ? variable : "";
}

// Evaluates and returns variable if it's a function, otherwise just returns it.
// Passes surplus arguments on to the function.
// TODO: xxx argument forwarding needs testing.
function valOf (variable) { 
    if (typeof variable == "function") {
        return variable.apply(this, Array.prototype.slice.call(arguments,1));
    } else {
        return variable;
    }
}


function bake_cookie(name, value) {
    var exdate=new Date();
    exdate.setDate(exdate.getDate() + 30);
    var cookie = [name, "=", JSON.stringify(value),"; expires=.", exdate.toUTCString(), "; domain=.", window.location.host.toString(), "; path=/;"].join("");
    document.cookie = cookie;
}
function read_cookie(name) {
    var result = document.cookie.match(new RegExp(name + "=([^;]+)"));
    if (result) { result = JSON.parse(result[1]); }

    return result;
}


// Calculates the summation of elements (n...m] of the arithmetic sequence
// with increment "incr".
function calcArithSum(incr,n,m)
{
    // Default to just element n+1, if m isn't given.
    if (m === undefined) { m = n + 1; }
    return (m-n)*((n*incr)+((m-1)*incr))/2;
}


// Search for the largest integer X that generates func(X) < limitY.
// func should be a continuous increasing numeric function.
//xxx This would probably be more elegant written recursively.
function logSearchFn(func, limitY)
{
    var minX = 0;
    var maxX = 0;
    var curX = 0;
    var curY;

    // First, find an upper bound.
    while ((curY = func(maxX)) <= limitY)
    {
        minX = maxX;  // Previous was too low
        maxX = maxX ? maxX * 2 : (maxX + 1);
    }
    // Invariant:  minX <= desired X < maxX

    // Now binary search the range.
    while (maxX - minX > 1)
    {
        curX = Math.floor((maxX + minX)/2); // Find midpoint
        curY = func(curX);

        if (curY <= limitY)
        {
            minX = curX; // Under limit; becomes new lower bound.
        }
        else
        {
            maxX = curX; // Over limit; becomes new upper bound.
        }
    }

    return minX;
}

// Recursively merge the properties of one object into another.
// Similar (though not identical) to jQuery.extend()
function mergeObj(o1, o2) 
{
    var i;

    if (o2 === undefined) { return o1; }

    // If either one is a non-object, just clobber o1.
    if ((typeof(o2) != "object") || (o1 === null) ||
        (typeof(o1) != "object") || (o2 === null))
    {
        o1 = o2;
        return o1;
    }

    // Both are non-null objects.  Copy o2's properties to o1.
    for (i in o2) { if (o2.hasOwnProperty(i)) 
    {
        o1[i] = mergeObj(o1[i], o2[i]);
    }}

    return o1;
}


// Workaround for IE's lack of support for the dataset property.
// Also searches up the DOM tree on lookups, to mimic inheritance.
// Pass 'value' to set the value, otherwise returns the value.
// Returns "true" and "false" as actual booleans.
function dataset(elem,attr,value)
{
    if (value !== undefined) { return elem.setAttribute("data-"+attr,value); }

    var val = null;
    for (var i = elem; i; i = i.parentNode)
    {
        if (i.nodeType != Node.ELEMENT_NODE) { continue; }
        val = i.getAttribute("data-"+attr); 
        if (val !== null) { break; }
    }
    return (val=="true")?true:(val=="false")?false:val;
}


// Probabilistic rounding function
function rndRound(num)
{
    var baseVal = Math.floor(num);
    return baseVal + ((Math.random() < (num - baseVal)) ? 1 : 0)
}


// Copy properties from to dest from src
// If 'names' array supplied, only copies the named properties
// If 'deleteOld' is true, deletes the properties from the old object
function copyProps(dest,src,names,deleteOld)
{
    if (!(names instanceof Array)) { names = Object.getOwnPropertyNames(src); }
    if (!isValid(deleteOld)) { deleteOld = false; }

    names.forEach(function(elem){
        if (!src.hasOwnProperty(elem)) { return; }
        // This syntax is needed to copy get/set properly; you can't just use '='.
        Object.defineProperty(dest,elem,Object.getOwnPropertyDescriptor(src,elem));
        if (deleteOld) { delete src[elem]; }
    });
}

// Delete the specified named cookie
function deleteCookie(cookieName)
{
    document.cookie = [cookieName, "=; expires=Thu, 01-Jan-1970 00:00:01 GMT; path=/; domain=.", window.location.host.toString()].join("");
}

// Get the fundamental object of the given type
function getStdObj(typeName)
{
    switch(typeName)
    {
        case "object": return Object;
        case "boolean": return Boolean;
        case "number": return Number;
        case "string": return String;
        case "function": return Function;
        default: return undefined;
    }
}

// Return one variable, coerced to the type of another.
function matchType(inVar, toMatch)
{
    return getStdObj(typeof toMatch)(inVar);
}

// Adds indices for the specified array.
// Looks for the specified attribute in each array entry, and adds an alias for
// it at the top level.
function indexArrayByAttr(inArray, attr) {
    inArray.forEach( function(elem,ignore,arr){
        // Add a named alias to each entry.
        if (isValid(elem[attr]) && !isValid(arr[elem[attr]])) {
            Object.defineProperty(arr, elem.id, { value : elem, enumerable:false });
        }
        else { console.log("Duplicate or missing "+attr+" attribute in array: "+elem[attr]); }
}); }

