var triggerKeyboard = function (element,type) {
	var keyboardEvent = document.createEvent("KeyboardEvent");
	var initMethod = typeof keyboardEvent.initKeyboardEvent !== 'undefined' ? "initKeyboardEvent" : "initKeyEvent";


	keyboardEvent[initMethod](
	                   type, // event type : keydown, keyup, keypress
	                    true, // bubbles
	                    true, // cancelable
	                    window, // viewArg: should be window
	                    false, // ctrlKeyArg
	                    false, // altKeyArg
	                    false, // shiftKeyArg
	                    false, // metaKeyArg
	                    40, // keyCodeArg : unsigned long the virtual key code, else 0
	                    0 // charCodeArgs : unsigned long the Unicode character associated with the depressed key, else 0
	);
	element.dispatchEvent(keyboardEvent);
}
var medium,testNode,fixture;
QUnit.moduleStart(function( details ) {
	testNode = $('<div id="test"></div>');
	fixture = $('<div id="qunit-fixture"></div>');
	$('body').append(fixture.append(testNode));
	medium = new Medium({
        element: testNode.get(0)
    });
});
QUnit.moduleDone(function( details ) {
	medium.destroy();
	fixture.remove();
});
module( "initialization" );
test('the container has the correct atrributes',1,function(){
	
	ok(testNode.hasClass('medium medium-rich'),'Initialization');
});
test('test enabling and disabling', 2, function() {
	medium.disable();
	equal(testNode.attr('contenteditable') , 'false','Disable medium');
	medium.enable();
	equal(testNode.attr('contenteditable'), 'true','Enable medium');
});
module( "events focus" );
asyncTest('focus event', 1, function() {
	var listener = function(e){
		ok(true,'focus event fires');
		testNode.get(0).removeEventListener('editableFocus',listener);
		start();
	};
	testNode.get(0).addEventListener('editableFocus',listener);
	testNode.get(0).focus();
	
});
module( "events blur" );
asyncTest('blur event', 1, function() {
	var listener = function(e){
		ok(true,'blur event fires');
		testNode.get(0).removeEventListener('editableBlur',listener);
		start();
	};
	testNode.get(0).addEventListener('editableBlur',listener);
	testNode.get(0).focus();
	testNode.get(0).blur();
	
});
module( "events modified" );
asyncTest('modified event', 2, function() {
	var listener = function(e){
		ok(true,'modified event fires');
		equal(e.data, '<p></p>','event passes the correct data');
		testNode.get(0).removeEventListener('editableModified',listener);
		start();
	};
	testNode.get(0).addEventListener('editableModified',listener);
	triggerKeyboard(testNode.get(0),'keydown');
	triggerKeyboard(testNode.get(0),'keypress');
	triggerKeyboard(testNode.get(0),'keyup');
});
