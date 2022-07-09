function UConsole()
{
	this.open = false;
	window.uconsole = this;

	this.history = [];
	this.post_history = [];

	this.root = document.createElement("div");
	this.root.innerHTML = "<div class='content'><div class='messages'></div></div><div class='typing'><input placeHolder='...'/><div class='hint'></div></div>";
	this.root.className = "uconsole";
	var that = this;

	this.root.style.display = "none";
	document.body.appendChild( this.root );

	var content = this.content = this.root.querySelector(".content");
	var messages = this.messages = this.root.querySelector(".messages");
	var hint = this.hint = this.root.querySelector(".hint");
	hint.style.display = "none";

	var input = this.input = this.root.querySelector(".typing input");
	input.addEventListener("keydown",function(e){
		//console.log(e.code,e.ctrlKey);
		if( e.keyCode == 38 ) //cursor up
		{
			if(that.history.length)
			{
				this.value = that.history.pop();
				that.post_history.push( this.value );
			}
			e.preventDefault();
			return;
		}

		if( e.keyCode == 40 ) //cursor down
		{
			if(!that.post_history.length)
			{
				this.value = "";
			}
			else
			{
				this.value = that.post_history.pop();
				that.history.push( this.value );
			}
			e.preventDefault();
			return;
		} else if(e.keyCode == 13)
		{
			that.history = that.history.concat( that.post_history.reverse() );
			that.post_history.length = 0;
			that.history.push( this.value );
			that.addMessage( "] " + this.value, "me",false);
			that.onCommand( this.value );
			this.style.opacity = 1;
			this.value = "";
			return;
		}
		else if(e.keyCode == 9) //TAB
		{
			var last = this.value.split(" ").pop();
			var options = [];
			var shared = that.autocomplete( last, options );
			if(shared)
				this.value = shared + " ";
			e.preventDefault();
			return;
		}
		else if( e.keyCode == 27) //ESC 
		{
			//hide
			that.toggle();
			e.preventDefault();
		}
		if(this.value.substr(0,4) == "key " || this.value.substr(0,8) == "tempkey ") //hide key
			this.style.opacity = 0;
		else
			this.style.opacity = 1;
	},true);

	document.addEventListener("keydown", this.onKey.bind(this), true );

	this.print("UConsole v1.0\n******************");

	console._log = console.log; console.log = this.system_log.bind(this);
	console._error = console.error; console.error = this.system_error.bind(this);
	console._warn = console.warn; console.warn = this.system_warn.bind(this);
	console.print = this.print.bind(this);
};

UConsole.prototype.print = function( str, className )
{
	var lines = str.split("/n");
	for(var i = 0; i < lines.length; ++i)
		this.addMessage( lines[i], "print " + (className || ""), true );
}

UConsole.prototype.log = function(str)
{
	this.addMessage( str, "log", false );
}

UConsole.prototype.system_log = function( str )
{
	this.log(str);
	console._log.apply(console,arguments);
}

UConsole.prototype.system_error = function( str )
{
	this.error(str);
	console._error.apply(console,arguments);
}

UConsole.prototype.system_warn = function( str )
{
	this.warn(str);
	console._warn.apply(console,arguments);
}

UConsole.prototype.error = function( str )
{
	this.addMessage( str, "error", false );
}

UConsole.prototype.warn = function( str )
{
	this.addMessage( str, "warn", false );
}

UConsole.prototype.addMessage = function(str, className, is_html)
{
	var elem = document.createElement("div");
	if( str.constructor === String || str.constructor === Number)
	{
		if(is_html)
			elem.innerHTML = str;
		else
			elem.innerText = str;
	}
	else if( str.constructor === Object )
			elem.innerHTML = JSON.stringify(str);
	else if( str.localName )
		elem.appendChild( str );
	else
		elem.innerHTML = String(str);

	elem.className = "msg " + (className || "");
	this.messages.appendChild(elem);
	if( this.messages.childNodes.length > 1000)
		this.messages.removeChild( this.messages.childNodes[0] );
	this.content.scrollTop = 1000000;
}

UConsole.prototype.onCommand = function( command )
{
	if(!command)
		return;

	if( command[0] == "=" )
	{
		this.addMessage( String( eval( command.slice(1) ) ), "pre" );
		return;
	}

	var tokens = command.match(/\S+|"[^"]+"/g);
	var cmd = tokens[0].trim();
	var func = UConsole.commands[ cmd ];
	if(func)
	{
		var r = func( tokens.slice(1) );
		if(r != undefined)
			this.print(r);
		return;
	}

	this.error("command not found: " + cmd);
}

UConsole.prototype.autocomplete = function( start, options )
{
	var valid = options || [];
	for(var i in UConsole.commands )
	{
		if( i.substr(0,start.length) == start )
			valid.push(i);
	}

	var shared = "";
	if( valid.length == 1 )
		shared = valid[0];
	else if( valid.length > 1 )
		shared = sharedStart( valid );
	return shared;
}

UConsole.prototype.toggle = function()
{
	this.open = !this.open;
	this.root.style.display = this.open ? "block" : "none";
	if(this.open)
		this.input.focus();
}

UConsole.prototype.onKey = function(e)
{
	//console.log(e);
	if( (e.code == "KeyO" && e.ctrlKey) || (e.code == "Space" && e.ctrlKey) )// || e.code == "Backquote" )
		this.toggle();
	else
		return true; //release the event so monaco can process it
	e.preventDefault();
	e.stopPropagation();
	e.stopImmediatePropagation();
	return false;
}

UConsole.commands = {};
UConsole.registerCommand = function( name, cmd )
{
	UConsole.commands[ name ] = cmd;
}

UConsole.registerCommand( "help", function(){
	for(var i in UConsole.commands)
		console.print( " + " + i, "cyan" );
});


function sharedStart(array){ var A= array.concat().sort(), a1= A[0], a2= A[A.length-1], L= a1.length, i= 0; while(i<L && a1.charAt(i)=== a2.charAt(i)) i++; return a1.substring(0, i); }
