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
                editor: 'medium',
                pasteHook: 'medium-paste-hook',
                placeholder: 'medium-placeholder'
            }
        },
        editor = null,
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
                },
                setCaretIn : function (node) {
                    var range,sel;
                    if (window.getSelection && document.createRange) {
                        node.focus();
                        range = document.createRange();
                        range.selectNodeContents(node);
                        range.collapse(true);
                        sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                    else if (document.body.createTextRange) 
                    {
                        range = document.body.createTextRange();
                        range.moveToElementText(node);
                        range.collapse(true);
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
                    
                    var innerText = utils.html.text(settings.element);
                    
                    // Empty Editer
                    if( innerText === ""  ){
                        settings.element.innerHTML = '';

                        // Add base P tag and do autofocus
                        var newNode = utils.html.addTag(settings.tags.paragraph, cache.initialized ? true : settings.autofocus);
                        if(settings.element.getAttribute('data-placeholder'))
                            newNode.setAttribute('data-placeholder',settings.placeholder || settings.element.getAttribute('data-placeholder'));

                    } else {
                        for (var i = settings.element.childNodes.length - 1; i >= 0; i--) {
                            if( settings.element.childNodes[i].getAttribute && settings.element.childNodes[i].getAttribute('data-placeholder') )
                            {
                                settings.element.childNodes[i].removeAttribute('data-placeholder')
                            }
                        }
                    }
                },
                clean: function (node) {

                    /*
                     * Deletes invalid nodes
                     * Removes Attributes
                     */
                    var attsToRemove = ['style','class'],
                        parent = (node === undefined ? settings.element : node),
                        children = parent.children,
                        i, j, k,
                        replace = [];


                    // if the parent is baiscally empty, non of the logic should execute
                    if(parent.children.length == 1 && utils.html.text(parent) == "")
                        return;
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
                                }
                                else
                                {
                                    var p = document.createElement('p');
                                    p.innerText = txt;
                                    replace[i] = p;
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
                        }
                        replace.pop().parentNode.normalize();
                    }
                },
                checkNode : function (node) {
                    // Determine if we should modify node
                    if(settings.mode == "inline")
                        return true;
                    else
                        var whiteList = settings.mode == "partial" ? ['p'] : (settings.tags.outerLevel).concat([settings.tags.paragraph]);
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
                        // utils.cursor.set( 0, toFocus );
                        utils.cursor.setCaretIn(toFocus );
                    }
                    return newEl
                    
                }
            },
            
            /*
             * This is a Paste Hook. When the user pastes
             * content, this ultimately converts it into
             * plain text nefore inserting the data.
            
            pasteHook: function(fn,e){
                var input = d.createElement('div');
                input.setAttribute('contenteditable',"true");
                input.className = settings.cssClasses.pasteHook;
                settings.element.appendChild(input);
                var pasteHookNode = utils.getElementsByClassName( settings.cssClasses.pasteHook, settings.element )[0];
                settings.element.setAttribute('contenteditable','false');
                pasteHookNode.focus();
                if(e && e.clipboardData && e.clipboardData.getData)
                {
                    if (/text\/html/.test(e.clipboardData.types)) 
                    {
                        pasteHookNode.innerHTML = e.clipboardData.getData('text/html');
                    }
                    else if(/text\/plain/.test(e.clipboardData.types))
                    {
                        pasteHookNode.innerHTML = e.clipboardData.getData('text/plain');
                    }
                    if (e.preventDefault) 
                    {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                }
                setTimeout(function(){
                    settings.element.setAttribute('contenteditable','true');
                    var v = pasteHookNode;
                    fn.call(null, v);
                    utils.html.deleteNode( pasteHookNode );
                }, 10);
            } */
        },
        intercept = {
            skip : {},
            focus: function(e){
                //_log('FOCUSED');
                var event = new CustomEvent('editableFocus');
                settings.element.dispatchEvent(event);
                if(settings.element.innerHTML == '<p data-placeholder="'+settings.placeholder+'"></p>')
                {
                    utils.cursor.setCaretIn(settings.element.childNodes[0]);
                }
            },
            blur: function(e){
                var event = new CustomEvent('editableBlur');
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
                        
                        // intercept.command[cmd].call(null, e);
                    }
                });
                
                if( settings.maxLength !== -1 ){
                    // var ph = settings.element.getElementsByClassName(settings.cssClasses.placeholder)[0],
                    var len = utils.html.text().length;
                        
                    // if(settings.placeholder && ph){
                    //     len -= settings.placeholder.length;
                    // }
                    if( len >= settings.maxLength && utils.isNotSpecial(e) ){
                        return utils.preventDefaultEvent(e);
                    }
                    // _log(len+'/'+settings.maxLength);
                }
                
                if( e.which === 13 ){
                    intercept.enterKey.call(null, e);
                }
            },
            up: function(e){
                if(intercept.skip.up)
                {
                    intercept.skip.up = false;
                    return true;
                }
                utils.isCommand(e, function(){
                    cache.cmd = false;
                }, function(){
                    cache.cmd = true;
                });
                var sel = utils.selection.saveSelection();
                // utils.html.clean();
                utils.selection.restoreSelection(sel);
                utils.html.placeholders();
                // action.preserveElementFocus();
                var event = new CustomEvent('editableModified');
                event.data = settings.element.innerHTML;
                settings.element.dispatchEvent(event);
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
                   return intercept.paste(e);
                }
            },
            paste : function (e) {
                // var sel = utils.selection.saveSelection();
                // utils.pasteHook(function(node){
                //     utils.selection.restoreSelection( sel );
                //     utils.html.clean(node);
                //     // var frag = document.createDocumentFragment();
                //     var tmp = document.createElement('div');
                //     // frag.appendChild(tmp);
                //     for (var i = 0; i < node.childNodes.length; i++) {
                //         tmp.appendChild(node.childNodes[i]);
                //     }
                //     var html = tmp.innerHTML;
                //     d.execCommand('insertHTML', false, html );
                //     // d.execCommand('insertHTML', false, text.replace(/\n/g, '<br>') );
                // },e);
                var sel = utils.selection.saveSelection();
                var input = d.createElement('div');
                input.setAttribute('contenteditable',"true");
                input.className = settings.cssClasses.pasteHook;
                settings.element.appendChild(input);
                var pasteHookNode = utils.getElementsByClassName( settings.cssClasses.pasteHook, settings.element )[0];
                settings.element.setAttribute('contenteditable','false');
                pasteHookNode.focus();
                intercept.skip.up = true;
                utils.cursor.setCaretIn(pasteHookNode);
                window.setTimeout(function() {
                    settings.element.setAttribute('contenteditable','true');
                    utils.selection.restoreSelection( sel );
                    utils.html.clean(pasteHookNode);
                    if(settings.mode == 'inline')
                    {
                        var p = document.createElement('p');
                        var newStr = pasteHookNode.innerText.replace(/(\r\n|\n|\r)/gm," ");
                        if(settings.maxLength >= 0)
                            newStr = newStr.substring(0,settings.maxLength + 1);
                        p.innerText = newStr;
                        for (var i = pasteHookNode.childNodes.length - 1; i >= 0; i--) {
                            utils.html.deleteNode(pasteHookNode.childNodes[i]);
                        }
                        pasteHookNode.appendChild(p);
                    }
                    d.execCommand('insertHTML', false, pasteHookNode.innerHTML );
                    utils.html.deleteNode( pasteHookNode );
                    var event = new Event('editableModified');
                    event.data = settings.element.innerHTML;
                    settings.element.dispatchEvent(event);
                }, 10);
                return true;
            },
            enterKey: function (e) {
            
                if( settings.mode === "inline" ){
                    return utils.preventDefaultEvent(e);
                }

                if( e.altKey ){
                    
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
            if(ZenEditor && settings.mode == "rich")
                new ZenEditor(settings.element);
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
        };

        this.enable = function (){
            settings.element.contentEditable = true;
            settings.enabled = true;
        };
        
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


// From zenpen.io A minimal web based text editor for the modern man.
// for license please refer to https://github.com/tholman/zenpen/blob/master/licence.md

(function(w, d){

    'use strict';
    
    /*
     * Fix IE shit
     */
var ZenEditor = function(element) {

    // Editor elements
    var headerField, contentField, cleanSlate, lastType, currentNodeList, savedSelection, lastSelection;

    // Editor Bubble elements
    var textOptions, optionsBox, boldButton, italicButton, quoteButton, urlButton, urlInput;




    function init(elementNode) {


        contentField = elementNode;
        // lastRange = 0;
        bindElements();

        // Set cursor position
        // var range = document.createRange();
        // var selection = window.getSelection();
        // range.setStart(headerField, 1);
        // selection.removeAllRanges();
        // selection.addRange(range);

        createEventBindings();


        // Load state if storage is supported
        // if ( supportsHtmlStorage() ) {
        //     loadState();
        // }
    }

    function createEventBindings( on ) {

        // Key up bindings
        // if ( supportsHtmlStorage() ) {

        //     document.onkeyup = function( event ) {
        //         checkTextHighlighting( event );
        //         saveState();
        //     }

        // } else {
        addEvent(document,'keyup',checkTextHighlighting);
            // document.onkeyup = checkTextHighlighting;
        // }

        // Mouse bindings
        addEvent(document,'mousedown',checkTextHighlighting);
        addEvent(document,'mouseup',checkTextHighlightingNext);
        // document.onmousedown = checkTextHighlighting;
        // document.onmouseup = function( event ) {

        //     setTimeout( function() {
        //         checkTextHighlighting( event );
        //     }, 1);
        // };
        
        // Window bindings
        addEvent(window,'resize',updateBubblePosition);
        // window.addEventListener( 'resize', function( event ) {
        //     updateBubblePosition();
        // });

        // Scroll bindings. We limit the events, to free the ui
        // thread and prevent stuttering. See:
        // http://ejohn.org/blog/learning-from-twitter
        var scrollEnabled = true;
        document.body.addEventListener( 'scroll', function() {
            
            if ( !scrollEnabled ) {
                return;
            }
            
            scrollEnabled = true;
            
            updateBubblePosition();
            
            return setTimeout((function() {
                scrollEnabled = true;
            }), 250);
        });
    }

    function bindElements() {

        // headerField = document.querySelector( '.header' );
        // contentField = document.querySelector( '.content' );
        textOptions = document.querySelector( '.text-options' );

        if(!textOptions)
        {
            textOptions = document.createElement('div');
            textOptions.className = "text-options";
            var optionsHtml = '<div class="options">'+
                '<span class="no-overflow">'+
                    '<span class="lengthen ui-inputs">'+
                        '<button class="url useicons">&#xe005;</button>'+
                        '<input class="url-input" type="text" placeholder="Type or Paste URL here"/>'+
                        '<button class="bold">b</button>'+
                        '<button class="italic">i</button>'+
                        '<button class="quote">&rdquo;</button>'+
                    '</span>'+
                '</span>'+
            '</div>';
            textOptions.innerHTML = optionsHtml;
            document.body.appendChild(textOptions);
        }
        optionsBox = textOptions.querySelector( '.options' );

        boldButton = textOptions.querySelector( '.bold' );
        boldButton.onclick = onBoldClick;

        italicButton = textOptions.querySelector( '.italic' );
        italicButton.onclick = onItalicClick;

        quoteButton = textOptions.querySelector( '.quote' );
        quoteButton.onclick = onQuoteClick;

        urlButton = textOptions.querySelector( '.url' );
        urlButton.onmousedown = onUrlClick;

        urlInput = textOptions.querySelector( '.url-input' );
        urlInput.onblur = onUrlInputBlur;
        urlInput.onkeydown = onUrlInputKeyDown;
    }

    function checkTextHighlighting( event ) {

        var selection = window.getSelection();

        if ( (event.target.className === "url-input" ||
             event.target.classList.contains( "url" ) ||
             ( event.target.parentNode.classList && event.target.parentNode.classList.contains( "ui-inputs")) ) ) {

            currentNodeList = findNodes( selection.focusNode );
            updateBubbleStates();
            return;
        }

        // Check selections exist
        if ( selection.isCollapsed === true && lastType === false ) {

            onSelectorBlur();
        }

        // Text is selected
        if ( selection.isCollapsed === false ) {

            currentNodeList = findNodes( selection.focusNode );

            // Find if highlighting is in the editable area
            // if ( hasNode( currentNodeList, "ARTICLE") ) {
            if (isDescendant(contentField, selection.focusNode)) {
                updateBubbleStates();
                updateBubblePosition();

                // Show the ui bubble
                textOptions.className = "text-options active";
            }
        }

        lastType = selection.isCollapsed;
    }
    function checkTextHighlightingNext( event ) {
        setTimeout( function() {
            checkTextHighlighting( event );
        }, 1);
    }
    function updateBubblePosition() {
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);
        var boundary = range.getBoundingClientRect();
        var optionsBoundry = textOptions.childNodes[0].getBoundingClientRect();
        
        textOptions.style.top = boundary.bottom + optionsBoundry.height + 15 + window.pageYOffset + "px";
        textOptions.style.left = (boundary.left + boundary.right)/2 + "px";
    }

    function updateBubbleStates() {

        // It would be possible to use classList here, but I feel that the
        // browser support isn't quite there, and this functionality doesn't
        // warrent a shim.

        if ( hasNode( currentNodeList, 'B') ) {
            boldButton.className = "bold active"
        } else {
            boldButton.className = "bold"
        }

        if ( hasNode( currentNodeList, 'I') ) {
            italicButton.className = "italic active"
        } else {
            italicButton.className = "italic"
        }

        if ( hasNode( currentNodeList, 'BLOCKQUOTE') ) {
            quoteButton.className = "quote active"
        } else {
            quoteButton.className = "quote"
        }

        if ( hasNode( currentNodeList, 'A') ) {
            urlButton.className = "url useicons active"
        } else {
            urlButton.className = "url useicons"
        }
    }

    function onSelectorBlur() {

        textOptions.className = "text-options fade";
        setTimeout( function() {

            if (textOptions.className == "text-options fade") {

                textOptions.className = "text-options";
                textOptions.style.top = '-999px';
                textOptions.style.left = '-999px';
            }
        }, 260 );
    }

    function findNodes( element ) {

        var nodeNames = {};

        while ( element.parentNode ) {

            nodeNames[element.nodeName] = true;
            element = element.parentNode;

            if ( element.nodeName === 'A' ) {
                nodeNames.url = element.href;
            }
        }

        return nodeNames;
    }

    // http://stackoverflow.com/questions/2234979/how-to-check-in-javascript-if-one-element-is-a-child-of-another
    function isDescendant(parent, child) {
       var node = child.parentNode;
       while (node !== null) {
           if (node == parent) {
               return true;
           }
           node = node.parentNode;
       }
       return false;
   }

   function hasNode( nodeList, name ) {

        return !!nodeList[ name ];
    }

    // function saveState( event ) {
        
    //     localStorage[ 'header' ] = headerField.innerHTML;
    //     localStorage[ 'content' ] = contentField.innerHTML;
    // }

    // function loadState() {

    //     if ( localStorage[ 'header' ] ) {
    //         headerField.innerHTML = localStorage[ 'header' ];
    //     }

    //     if ( localStorage[ 'content' ] ) {
    //         contentField.innerHTML = localStorage[ 'content' ];
    //     }
    // }

    function onBoldClick() {
        document.execCommand( 'bold', false );
    }

    function onItalicClick() {
        document.execCommand( 'italic', false );
    }

    function onQuoteClick() {

        var nodeNames = findNodes( window.getSelection().focusNode );

        if ( hasNode( nodeNames, 'BLOCKQUOTE' ) ) {
            document.execCommand( 'formatBlock', false, 'p' );
            document.execCommand( 'outdent' );
        } else {
            document.execCommand( 'formatBlock', false, 'blockquote' );
        }
    }

    function onUrlClick() {

        if ( optionsBox.className == 'options' ) {

            optionsBox.className = 'options url-mode';

            // Set timeout here to debounce the focus action
            setTimeout( function() {

                var nodeNames = findNodes( window.getSelection().focusNode );

                if ( hasNode( nodeNames , "A" ) ) {
                    urlInput.value = nodeNames.url;
                } else {
                    // Symbolize text turning into a link, which is temporary, and will never be seen.
                    document.execCommand( 'createLink', false, '/' );
                }

                // Since typing in the input box kills the highlighted text we need
                // to save this selection, to add the url link if it is provided.
                lastSelection = window.getSelection().getRangeAt(0);
                lastType = false;

                urlInput.focus();

            }, 100);

        } else {

            optionsBox.className = 'options';
        }
    }

    function onUrlInputKeyDown( event ) {

        if ( event.keyCode === 13 ) {
            event.preventDefault();
            applyURL( urlInput.value );
            urlInput.blur();
        }
    }

    function onUrlInputBlur( event ) {

        optionsBox.className = 'options';
        applyURL( urlInput.value );
        urlInput.value = '';

        currentNodeList = findNodes( window.getSelection().focusNode );
        updateBubbleStates();
    }

    function applyURL( url ) {

        rehighlightLastSelection();

        // Unlink any current links
        document.execCommand( 'unlink', false );

        if (url !== "") {
        
            // Insert HTTP if it doesn't exist.
            if ( !url.match("^(http|https)://") ) {

                url = "http://" + url;  
            } 

            document.execCommand( 'createLink', false, url );
        }
    }

    function rehighlightLastSelection() {

        window.getSelection().addRange( lastSelection );
    }

    function getWordCount() {
        
        var text = get_text( contentField );

        if ( text === "" ) {
            return 0
        } else {
            return text.split(/\s+/).length;
        }
    }
    function addEvent(element, eventName, func) {
        if (element.addEventListener) {
            element.addEventListener(eventName, func, false);
        } else if (element.attachEvent) {
            element.attachEvent("on" + eventName, func);
        }
    }
    function removeEvent(element, eventName, func) {
        if (element.addEventListener) {
            element.removeEventListener(eventName, func, false);
        } else if (element.attachEvent) {
            element.detachEvent("on" + eventName, func);
        }
    }

    init(element);
};
 // Exports and modularity
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ZenEditor;
    }

    if (typeof ender === 'undefined') {
        this.ZenEditor = ZenEditor;
    }

    if (typeof define === "function" && define.amd) {
        define('ZenEditor', [], function () {
            return ZenEditor;
        });
    }
}).call(this, window, document);
