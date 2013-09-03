/*
 * Medium.js
 *
 * Copyright 2013, Jacob Kelley - http://jakiestfu.com/
 * Released under the MIT Licence
 * http://opensource.org/licenses/MIT
 *
 * Github:  http://github.com/jakiestfu/Medium.js/
 * Version: 1.0
 */


(function(w, d){

    'use strict';
    
    /*
     * Fix IE shit
     */
    if( typeof String.prototype.trim !== 'function' ){
        String.prototype.trim = function() {
            return this.replace(/^\s+|\s+$/g, '');
        }
    }

    var Medium = Medium || function (userOpts) {

        var settings = {
            debug: true,
            element: null,
            modifier: 'auto',
            placeholder: "",
            autofocus: false,
            autoHR: false,
            mode: 'rich', // inline, partial, rich
            maxLength: -1,
            enabled : true,
            modifiers: {
                66: 'bold',
                73: 'italicize',
                85: 'underline',
                86: 'paste'
            },
            tags: {
                paragraph: 'p',
                outerLevel: ['pre','blockquote', 'figure', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol'],
                innerLevel: ['a', 'b', 'u', 'i', 'img', 'strong'] // Todo: Convert strong to b (IE)
            },
            cssClasses: {
                editor: 'Medium',
                pasteHook: 'Medium-paste-hook',
                placeholder: 'Medium-placeholder'
            }
        },
        cache = {
            initialized: false,
            cmd: false,
            focusedElement: null
        },
        _log = function (w) {
            if (settings.debug) {
                console.log(w);
            }
        },
        utils = {
            /*
             * Keyboard Interface events
             */
            isCommand: function(e, fnTrue, fnFalse){
                if((settings.modifier==='ctrl' && e.ctrlKey ) ||
                   (settings.modifier==='cmd' && e.metaKey ) ||
                   (settings.modifier==='auto' && (e.ctrlKey || e.metaKey) )
                ){
                    return fnTrue.call();
                } else {
                    return fnFalse.call();
                }
            },
            isShift: function(e, fnTrue, fnFalse){
                if(e.shiftKey){
                    return fnTrue.call();
                } else {
                    return fnFalse.call();
                }
            },
            isModifier: function(e, fn){
                var w = e.which,
                    cmd = settings.modifiers[w];
                if(cmd){
                    return fn.call(null, cmd);
                }
            },
            isNotSpecial: function(e){
                var special = {
                    16: 'shift',
                    17: 'ctrl',
                    18: 'alt',
                    91: 'cmd',
                    8: 'delete'
                };
                if(cache.cmd){ return false; }
                return !(e.which in special);
            },
            /*
             * Handle Events
             */
            addEvent: function addEvent(element, eventName, func) {
                if (element.addEventListener) {
                    element.addEventListener(eventName, func, false);
                } else if (element.attachEvent) {
                    element.attachEvent("on" + eventName, func);
                }
            },
            removeEvent: function addEvent(element, eventName, func) {
                if (element.addEventListener) {
                    element.removeEventListener(eventName, func, false);
                } else if (element.attachEvent) {
                    element.detachEvent("on" + eventName, func);
                }
            },
            preventDefaultEvent: function (e) {
                if (e.preventDefault) {
                    e.preventDefault();
                } else {
                    e.returnValue = false;
                }
            },
            /*
             * Utilities
             */
            getElementsByClassName: function(classname, el) {
                el = el ? el : document.body;
                var a = [],
                    re = new RegExp('(^| )'+classname+'( |$)'),
                    els = el.getElementsByTagName("*");
                for(var i=0,j=els.length; i<j; i++){
                    if(re.test(els[i].className)){
                        a.push(els[i]);
                    }
                }
                return a;
            },
            deepExtend: function (destination, source) {
                for (var property in source) {
                    if (source[property] && source[property].constructor && source[property].constructor === Object) {
                        destination[property] = destination[property] || {};
                        utils.deepExtend(destination[property], source[property]);
                    } else {
                        destination[property] = source[property];
                    }
                }
                return destination;
            },
            
            /*
             * Handle Selection Logic
             */
            selection: {
                saveSelection: function() {
                    if (w.getSelection) {
                        var sel = w.getSelection();
                        if (sel.rangeCount > 0) {
                              return sel.getRangeAt(0);
                        }
                    } else if (d.selection && d.selection.createRange) { // IE
                        return d.selection.createRange();
                    }
                    return null;
                },
                
                restoreSelection: function(range) {
                    if (range) {
                        if (w.getSelection) {
                            var sel = w.getSelection();
                            sel.removeAllRanges();
                            sel.addRange(range);
                        } else if (d.selection && range.select) { // IE
                            range.select();
                        }
                    }
                }
            },
            
            /*
             * Handle Cursor Logic
             */
            cursor: {
                set: function (pos, el) {
                    if( d.createRange ){
                        var range = d.createRange(),
                            selection = w.getSelection(),
                            lastChild = utils.html.lastChild(),
                            length =  utils.html.text(lastChild).length-1,
                            toModify = el ? el : lastChild,
                            theLength = typeof pos !== 'undefined' ? pos : length;
                        range.setStart(toModify, theLength);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } else {
                        var range = d.body.createTextRange();
                        range.moveToElementText(el);
                        range.collapse(false);
                        range.select();
                    }
                }
            },
            
            /*
             * HTML Abstractions
             */
            html: {
                text: function(node, val){
                    node = node || settings.element;
                    if(val){
                        if ((node.textContent) && (typeof (node.textContent) != "undefined")) {
                            node.textContent = val;
                        } else {
                            node.innerText = val;
                        }
                    }
                    return (node.textContent || node.innerText || "").trim();
                },
                changeTag: function(oldNode, newTag) {
                    var newNode = d.createElement(newTag),
                        node,
                        nextNode;

                    node = oldNode.firstChild;
                    while (node) {
                        nextNode = node.nextSibling;
                        newNode.appendChild(node);
                        node = nextNode;
                    }

                    oldNode.parentNode.insertBefore(newNode, oldNode);
                    oldNode.parentNode.removeChild(oldNode);
                },
                deleteNode: function(el){
                    if(el.parentNode)
                        el.parentNode.removeChild(el);
                },
                placeholders: function(){
                
                    
                    
                    var placeholders = utils.getElementsByClassName(settings.cssClasses.placeholder, settings.element),
                        innerText = utils.html.text(settings.element);
                    
                    // Empty Editer
                    if( innerText === ""  ){
                        settings.element.innerHTML = '';
                        
                        // We need to add placeholders
                        // if(settings.placeholder.length > 0){ 
                        //     utils.html.addTag(settings.tags.paragraph, false, false);
                        //     var c = utils.html.lastChild();
                        //     c.className = settings.cssClasses.placeholder;
                        //     utils.html.text(c, settings.placeholder);
                        // }
                        
                        // Add base P tag and do autofocus
                        var newNode = utils.html.addTag(settings.tags.paragraph, cache.initialized ? true : settings.autofocus);
                        if(settings.element.getAttribute('data-placeholder'))
                            newNode.setAttribute('data-placeholder',settings.element.getAttribute('data-placeholder'));

                    } else {
                        // if(innerText !== settings.placeholder){
                        //     var i;
                        //     for(i=0; i<placeholders.length; i++){
                        //         utils.html.deleteNode(placeholders[i]);
                        //     }
                        // }
                    }
                },
                clean: function (node) {

                    /*
                     * Deletes invalid nodes
                     * Removes Attributes
                     */
                    var attsToRemove = ['style','class'],
                        children = (node === undefined ? settings.element.children : node.children),
                        i, j, k,
                        replace = [];
                    
                    // Go through top level children
                    for(i=0; i<children.length; i++){
                        var child = children[i],
                            nodeName = child.nodeName,
                            shouldDelete = true;

                        // Remove attributes                   
                        for(k=0; k<attsToRemove.length; k++){
                            if( child.hasAttribute( attsToRemove[k] ) ){
                                if( child.getAttribute( attsToRemove[k] ) !== settings.cssClasses.placeholder ){
                                    child.removeAttribute( attsToRemove[k] );
                                }
                            }
                        }

                        shouldDelete = this.checkNode(child);

                        //
                        if(shouldDelete && child.childNodes.length > 0)
                        {
                            var txt = child.innerText;
                            if(txt)
                            {
                                var clone = child.cloneNode();
                                clone.innerHTML = child.innerText || child.textContent;
                                if(clone.childNodes.length > 0 && !this.checkNode(clone.childNodes[0]))
                                {
                                    replace[i] = clone.childNodes[0];
                                    // child.parentNode.replaceChild(child);
                                }
                                else
                                {
                                    replace[i] = document.createTextNode(txt);
                                    // child.parentNode.replaceChild(newNode,child);
                                }
                                shouldDelete = false;
                            }
                        }
                        
                        // Convert tags or delete
                        if(shouldDelete){
                            switch( nodeName.toLowerCase() ){
                                case 'div':
                                    utils.html.changeTag(child, settings.tags.paragraph);
                                    break;
                                default:
                                    utils.html.deleteNode(child);
                                    break;
                            }
                        }
                    }
                    if (replace.length > 0)
                    {
                        var childArr = Array.prototype.slice.call( children );
                        for (var i = 0; i < replace.length; i++) {
                            if(replace[i])
                            {
                                if(replace[i].textContent)
                                    replace[i].textContent.trim();
                                else if(replace[i].innerText)
                                    replace[i].innerText.trim();
                               childArr[i].parentNode.replaceChild(replace[i],childArr[i]);
                            }
                        };
                        replace[0].parentNode.normalize();
                    }
                },
                checkNode : function (node) {
                    // Determine if we should modify node
                    var whiteList = (settings.tags.outerLevel).concat([settings.tags.paragraph]);
                    var returnValue = true;
                    // use Array.indexOf if available
                    if(whiteList.indexOf)
                    {
                        if(whiteList.indexOf(node.nodeName.toLowerCase()) >= 0)
                            returnValue = false;
                    }
                    else
                    {
                        for(j=0; j<whiteList.length;j++){
                            if( whiteList[j] === node.nodeName.toLowerCase() ){
                                returnValue = false;
                            }
                        }
                    }
                    return returnValue;
                },
                lastChild: function () {
                    return settings.element.lastChild;
                },
                addTag: function (tag, shouldFocus, isEditable, afterElement) {
                    var newEl = d.createElement(tag),
                        toFocus;

                    if( typeof isEditable !== "undefined" && isEditable === false ){
                        newEl.contentEditable = false;
                    }
                    newEl.innerHTML = '';
                    if( afterElement && afterElement.nextSibling ){
                        afterElement.parentNode.insertBefore( newEl, afterElement.nextSibling );
                        toFocus = afterElement.nextSibling;
                        
                    } else {
                        settings.element.appendChild(newEl);
                        toFocus = utils.html.lastChild();
                    }
                    
                    if( shouldFocus ){
                        cache.focusedElement = toFocus;
                        utils.cursor.set( 0, toFocus );
                    }
                    return newEl
                    
                }
            },
            
            /*
             * This is a Paste Hook. When the user pastes
             * content, this ultimately converts it into
             * plain text nefore inserting the data.
             */
            pasteHook: function(fn){
                var input = d.createElement('div');
                input.setAttribute('contenteditable',"true");
                input.className = settings.cssClasses.pasteHook;
                settings.element.appendChild(input);
                var pasteHookNode = utils.getElementsByClassName( settings.cssClasses.pasteHook, settings.element )[0];
                settings.element.setAttribute('contenteditable','false');
                pasteHookNode.focus();
                setTimeout(function(){
                    settings.element.setAttribute('contenteditable','true');
                    var v = pasteHookNode;
                    fn.call(null, v);
                    utils.html.deleteNode( pasteHookNode );
                }, 10);
            }
        },
        intercept = {
            focus: function(e){
                //_log('FOCUSED');
                console.log('focus');
                var event = new Event('editableFocus');
                settings.element.dispatchEvent(event);
            },
            blur: function(e){
                //_log('FOCUSED');
                console.log('blur');
                 var event = new Event('editableBlur');
                settings.element.dispatchEvent(event);
            },
            down: function(e){
                
                utils.isCommand(e, function(){
                    cache.cmd = true;
                }, function(){
                    cache.cmd = false;
                });
                utils.isShift(e, function(){
                    cache.shift = true;
                }, function(){
                    cache.shift = false;
                });
                utils.isModifier(e, function(cmd){
                    if( cache.cmd ){
                        
                        if( ( (settings.mode === "inline") || (settings.mode === "partial") ) && cmd !== "paste" ){
                            return;
                        }
                        
                        intercept.command[cmd].call(null, e);
                    }
                });
                
                if( settings.maxLength !== -1 ){
                    var ph = settings.element.getElementsByClassName(settings.cssClasses.placeholder)[0],
                        len = utils.html.text().length;
                        
                    if(settings.placeholder && ph){
                        len -= settings.placeholder.length;
                    }
                    if( len >= settings.maxLength && utils.isNotSpecial(e) ){
                        return utils.preventDefaultEvent(e);
                    }
                    _log(len+'/'+settings.maxLength);
                }
                
                if( e.which === 13 ){
                    intercept.enterKey.call(null, e);
                }
            },
            up: function(e){
                utils.isCommand(e, function(){
                    cache.cmd = false;
                }, function(){
                    cache.cmd = true;
                });
                utils.html.clean();
                utils.html.placeholders();
                action.preserveElementFocus();
            },
            command: {
                bold: function(e){
                    utils.preventDefaultEvent(e);
                    // IE uses strong instead of b
                    d.execCommand( 'bold', false ); _log('Bold');
                },
                underline: function(e){
                    utils.preventDefaultEvent(e);
                    d.execCommand( 'underline', false ); _log('Underline');                
                },
                italicize: function(e){
                    utils.preventDefaultEvent(e);
                    d.execCommand( 'italic', false ); _log('Italic');
                },
                quote: function(e){},
                paste: function(e){
                   intercept.paste(e);
                }
            },
            paste : function (e) {
            var sel = utils.selection.saveSelection();
            utils.pasteHook(function(node){
                utils.selection.restoreSelection( sel );
                utils.html.clean(node);
                // var frag = document.createDocumentFragment();
                var tmp = document.createElement('div');
                // frag.appendChild(tmp);
                for (var i = 0; i < node.childNodes.length; i++) {
                    tmp.appendChild(node.childNodes[i]);
                }
                var html = tmp.innerHTML;
                d.execCommand('insertHTML', false, html );
                // d.execCommand('insertHTML', false, text.replace(/\n/g, '<br>') );
                });
            },
            enterKey: function (e) {
            
                if( settings.mode === "inline" ){
                    return utils.preventDefaultEvent(e);
                }

                if( !cache.shift ){
                    
                    utils.preventDefaultEvent(e);
                    
                    var focusedElement = cache.focusedElement;
                    
                    if( settings.autoHR && settings.mode !== 'partial' ){
                        var children = settings.element.children,
                            lastChild = children[ children.length-1 ],
                            makeHR = ( utils.html.text(lastChild) === "" ) && (lastChild.nodeName.toLowerCase() === settings.tags.paragraph );
                        
                        if( makeHR && children.length >=2 ){
                            var secondToLast = children[ children.length-2 ];
                            
                            if( secondToLast.nodeName.toLowerCase() === "hr" ){
                                makeHR = false;
                            }
                        }
        
                        if( makeHR ){
                            utils.preventDefaultEvent(e);
                            utils.html.deleteNode( lastChild );
                            utils.html.addTag('hr', false, false, focusedElement);
                            focusedElement = focusedElement.nextSibling;
                        }
                        utils.html.addTag(settings.tags.paragraph, true, null, focusedElement);
                    } else {
                        utils.html.addTag(settings.tags.paragraph, true, null, focusedElement);
                    }
                }
            }
        },
        action = {
            listen: function () {
                utils.addEvent(settings.element, 'keyup', intercept.up);
                utils.addEvent(settings.element, 'keydown', intercept.down);
                utils.addEvent(settings.element, 'focus', intercept.focus);
                utils.addEvent(settings.element, 'blur', intercept.blur);
                utils.addEvent(settings.element, 'paste', intercept.paste);
            },
            preserveElementFocus: function(){
                
                // Fetch node that has focus
                var anchorNode = w.getSelection ? w.getSelection().anchorNode : d.activeElement;
                if(anchorNode){
                    var cur = anchorNode.parentNode,
                        children = settings.element.children,
                        diff = cur !== cache.focusedElement,
                        elementIndex = 0,
                        i;
                    
                    // anchorNode is our target if element is empty
                    if (cur===settings.element){
                        cur = anchorNode;
                    }
                    
                    // Find our child index
                    for(i=0;i<children.length;i++){
                        if(cur === children[i]){
                            elementIndex = i;
                            break;
                        }
                    }
                    
                    // Focused element is different
                    if( diff ){
                        cache.focusedElement = cur;
                        cache.focusedElementIndex = elementIndex;
                    }
                }
            }
        },
        init = function (opts) {
        
            for(var key in settings){
                
                // Override defaults with data-attributes
                if( typeof settings[key] !== 'object' && settings.hasOwnProperty(key) && opts.element.getAttribute('data-medium-'+key) ){
                    var newVal = opts.element.getAttribute('data-medium-'+key);
                    
                    if( newVal.toLowerCase()==="false" || newVal.toLowerCase()==="true" ){
                        newVal = newVal.toLowerCase()==="true";
                    }
                    settings[key] = newVal;
                }
            }
        
            // Extend Settings
            utils.deepExtend(settings, opts);
    
            // Editable
            if(settings.enabled)
                settings.element.contentEditable = true;
            settings.element.className += (" ")+settings.cssClasses.editor;
            settings.element.className += (" ")+settings.cssClasses.editor+"-"+settings.mode;
            
            // Initialize editor
            utils.html.clean();
            utils.html.placeholders();
            action.preserveElementFocus();
            
            // Capture Events
            action.listen();
            
            // Set as initialized
            cache.initialized = true;
        };
        
        this.destroy = function(){
            utils.removeEvent(settings.element, 'keyup', intercept.up);
            utils.removeEvent(settings.element, 'keydown', intercept.down);
            utils.removeEvent(settings.element, 'focus', intercept.focus);
            utils.removeEvent(settings.element, 'blur', intercept.blur);
            utils.removeEvent(settings.element, 'paste', intercept.paste);
        };

        this.disable = function (){
            settings.element.contentEditable = false;
            settings.enabled = false;
        }

        this.enable = function (){
            settings.element.contentEditable = true;
            settings.enabled = true;
        }
        
        init(userOpts);
    
    };
    
    // Exports and modularity
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Medium;
    }

    if (typeof ender === 'undefined') {
        this.Medium = Medium;
    }

    if (typeof define === "function" && define.amd) {
        define('Medium', [], function () { 
            return Medium; 
        });
    }

}).call(this, window, document);
