var WIDGETS = {};

Math.clamp = function(v,a,b) { return (v < a ? a : (v > b ? b : v)); }

function remap(value,low1,high1,low2,high2)
{
	return low2 + (value - low1) * (high2 - low2) / (high1 - low1)
}

function inrange(v,maxv)
{
	v = v % maxv;
	if( v < 0)
		v += maxv;
	return v;
}

//0 is TOP, -90 is LEFT, 90 is RIGHT
function vectorFromAngle( angle, r )
{
	r = r || 1;
	return [Math.sin(angle)*r,-Math.cos(angle)*r];
}

function Interface()
{
	this.root = new Widget();
    this.root.ui = this;
	//this.root.name = "root";
	this.root.is_root = true;
	this.hover_widget = null; //below the mouse
	this.active_widget = null;//being clicked
	this.selected_widget = null;//last widget clicked
	this.background_color = null;

	this.onWidgetChange = null; //called when a widget chagnes value (name,value,widget)
}

WIDGETS.Interface = Interface;

Interface.prototype.getValues = function(v)
{
	v = v || {};
	this.root.getAllValues(v);
	return v;
}

Interface.prototype.setValues = function(v)
{
	this.root.setAllValues(v);
}

Interface.prototype.draw = function(ctx)
{
	if(this.background_color)
	{
		ctx.fillStyle = this.background_color;
		ctx.fillRect( this.root.position[0], this.root.position[1], this.root.size[0], this.root.size[1]);
	}
	ctx.lineWidth = 2;
	ctx.save();
	this.root.draw( ctx );
	ctx.restore();
}

Interface.prototype.add = function(widget)
{
	this.root.add( widget );
}

Interface.prototype.onKey = function(e)
{
	if(this.selected_widget && this.selected_widget.onKey)
		return this.selected_widget.onKey(e);
}

Interface.prototype.onMouse = function(e)
{
	var w = this.root.getHover( e.mousex - this.root.position[0], e.mousey - this.root.position[1]);
	if( w != this.hover_widget)
	{
		if(this.hover_widget)
			this.hover_widget.flags.hover = false;
		this.hover_widget = w;
		if(this.hover_widget)
			this.hover_widget.flags.hover = true;
	}

	if( e.type == "mousedown" )
	{
		if(this.selected_widget && this.selected_widget != w)
			this.selected_widget.flags.selected = false;
		this.selected_widget = w;
		if(this.selected_widget)
			this.selected_widget.flags.selected = true;

		this.active_widget = w;
		if(this.active_widget)
			this.active_widget.flags.active = true;
		if(w && w.onMouse && !w.flags.disabled )
			if( w.onMouse(e) )
				return true;
	}
	else if( e.type == "mousemove" )
	{
		if(	this.active_widget && this.active_widget.onMouse && !this.active_widget.flags.disabled )
			if( this.active_widget.onMouse(e) )
				return true;
	}
	else if( e.type == "mouseup" )
	{
		var old = this.active_widget;
		if(old)
			old.flags.active = false;
		this.active_widget = null;
		if(	old && !old.flags.disabled )
		{
			var r = old.onMouse && old.onMouse(e);
			if( old.onChangeEnd )
				old.onChangeEnd();
			if( r )
				return true;
		}
	}
	return this.hover_widget != null;
}

function Widget()
{
	this.position = [0,0];
	this.scale = 1;
	this.size = [100,100];

	this.parent = null;
	this.children = [];
	this.flags = { 
		visible: true 
	}; //also active,hover,selected
}

WIDGETS.Widget = Widget;

Widget.prototype.configure = function(json)
{
	for(var i in json)
	{
		var value = json[i];
		if( i == "flags")
			for(var j in value)
				this.flags[j] = value[j];
		else
			this[i] = json[i];
	}
}

Widget.prototype.add = function(widget)
{
	if(widget.parent)
		throw("already has parent");
	widget.parent = this;
	if(this.ui)
		widget.ui = this.ui;
	this.children.push(widget);
}

Widget.prototype.remove = function(widget)
{
	var index = this.children.indexOf(widget);
	if(index == -1)
		throw("widget not child");
	this.children.splice( index, 1 );
	widget.parent = null;
}

Widget.prototype.getHover = function(x,y, skip_disabled)
{
	if( x < 0 || x >= this.size[0] ||
		y < 0 || y >= this.size[1] )
		return null;

	for(var i = this.children.length - 1; i >= 0; --i)
	{
		var w = this.children[i];
		if(!w.flags.visible || (skip_disabled && w.flags.disabled == true) )
			continue;
		var r = w.getHover( x / this.scale - w.position[0], y / this.scale - w.position[1] );
		if(r)
			return r;
	}

	return this;
}

Widget.prototype.draw = function( ctx )
{
	ctx.save();
	ctx.translate( this.position[0], this.position[1] );
	ctx.scale( this.scale, this.scale );
	this.drawWidget(ctx);

	for(var i = 0; i < this.children.length; ++i)
	{
		var w = this.children[i];
		if(w.flags.visible)
			w.draw( ctx );
	}
	ctx.restore();
}

Widget.prototype.drawWidget = function( ctx )
{
	//ctx.strokeStyle = "white";
	//ctx.strokeRect( 0, 0, this.size[0], this.size[1] );
	if(this.img)
		ctx.drawImage( this.img, 0,0, this.size[0], this.size[1]);
	if(this.onDrawBackground)
		this.onDrawBackground(ctx);
	if(this.onDrawForeground)
		this.onDrawForeground(ctx);
}

Widget.prototype.globalToLocal = function(pos,out)
{
	out = out || [0,0];
	out[0] = pos[0];
	out[1] = pos[1];

	if(pos==out)
		throw("out cannot be the same as in");

	if(this.parent)
		this.parent.globalToLocal( pos, out );
	
	out[0] -= this.position[0];
	out[1] -= this.position[1];
	out[0] /= this.scale;
	out[1] /= this.scale;

	return out;
}

Widget.prototype.localToGlobal = function(pos,out)
{
	out = out || [0,0];
	aux = this;
	out[0] = pos[0];
	out[1] = pos[1];
	while(aux)
	{
		out[0] *= aux.scale;
		out[1] *= aux.scale;
		out[0] += aux.position[0];
		out[1] += aux.position[1];
		aux = aux.parent;
	}
	return out;
}

Widget.prototype.getValue = function()
{
	return this.value;
}

Widget.prototype.getAllValues = function( v )
{
	if( !this.is_root )
	{
		if(!this.name)
			return;

		if( !this.children.length )
		{
			v[this.name] = this.getValue();
			return v;
		}
	}

	var child_data = null;
	
	if(this.is_root)
		child_data = v;
	else
		child_data = v[this.name] = {};

	for(var i = 0; i < this.children.length; ++i)
	{
		var child = this.children[i];
		child.getAllValues(child_data);
	}

	return v;
}

//propagates change
Widget.prototype.processValueChange = function(widget,value)
{
	if(this.ui && this.ui.onWidgetChange)
		return this.ui.onWidgetChange(widget.name,value,widget);
	if(this.parent)
		this.parent.processValueChange(widget,value);
}

Widget.prototype.setAllValues = function( v )
{
	for(var i = 0; i < this.children.length; ++i)
	{
		var w = this.children[i];
		if(!w.name)
			continue;

		var value = v[w.name];
		if(value == null)
			continue;

		//has children
		if(w.children.length)
			w.setAllValues(values);
		else if(!w.flags.active) //avoid modifying while dragging
			w.value = value;
	}
}


// BUTTON *************************************

function Button()
{
	Widget.call(this);
	this.caption = null;
	this.callback = null;
	this.value = false;
	this.toggle = false;
	this.shape = Button.SQUARE;
}

Button.prototype.__proto__ = Widget.prototype;
WIDGETS.Button = Button;

Button.SQUARE = 1;
Button.CIRCLE = 2;

Button.prototype.onMouse = function( e )
{
	if(e.type == "mousedown")
	{
		this.flags.clicked = true;
		if(this.toggle)
		{
			var old = this.value;
			this.value = !this.value;
			this.processValueChange( this, this.value, old );
		}
		if(this.callback)
			this.callback(e);
	}
	else if(e.type == "mouseup")
	{
		this.flags.clicked = false;
	}
}

Button.prototype.drawWidget = function( ctx )
{
	ctx.fillStyle = this.flags.active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)";
	ctx.strokeStyle = "white";
	ctx.fillStyle = "#333";
	ctx.beginPath();
	if(this.shape == Button.CIRCLE)
		ctx.arc( 0.5 * this.size[0],0.5 * this.size[1], Math.min(this.size[0], this.size[1]) * 0.5 - 2, 0,Math.PI*2);
	else
		ctx.rect( 0.5,0.5, this.size[0], this.size[1]);

	if(!this.flags.disabled && (this.flags.hover || this.flags.active))
		ctx.fill();

	//ctx.fill();
	ctx.stroke();


	var h = this.size[1] * 0.5;
	if( this.caption != null && this.caption != "")
	{
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.font = "20px Arial";
		ctx.fillText(this.caption,this.size[0]*0.5 - (this.toggle?h:0),this.size[1]*0.5 + 10);
	}

	if(this.toggle)
	{
		ctx.fillStyle = this.value ? "green" : "black";
		ctx.fillRect( this.size[0] - h*1.5, h*0.5,h,h );
	}
}


function TextField()
{
	Widget.call(this);
	this.caption = null;
	this.callback = null;
	this.value = "";
}

TextField.prototype.__proto__ = Widget.prototype;
WIDGETS.TextField = TextField;

TextField.prototype.onMouse = function( e )
{
	if(e.type == "mousedown")
	{
		this.flags.clicked = true;
	}
	else if(e.type == "mouseup")
	{
		this.flags.clicked = false;
	}
}

TextField.prototype.onKey = function(e)
{
	if(e.type == "keydown")
	{
		switch(e.code)
		{
			case "Enter": this.flags.selected = false; 
				this.processValueChange( this, this.value );
				return; break;
			case "Backspace": this.value = this.value.substr(0,this.value.length-1); return; break;
		}

		if(e.character)
			this.value += e.character;
	}
}

TextField.prototype.drawWidget = function( ctx )
{
	ctx.fillStyle = this.flags.active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)";
	var selected = !this.flags.disabled && this.flags.selected;
	ctx.strokeStyle = "white";
	ctx.beginPath();
	ctx.rect( 0,0, this.size[0], this.size[1]);
	ctx.stroke();

	ctx.fillStyle = selected ? "white" : "#EEE";
	ctx.textAlign = "left";
	var fontsize = Math.floor(this.size[1] * 0.7);
	ctx.font = fontsize + "px Arial";
	var text = this.value;
	if( selected && Math.floor(getTime() * 0.001) % 2 == 0 )
		text += "_";
	ctx.fillText(text,fontsize*0.1,this.size[1]*0.75);
}

// DIAL ***************************************

function Dial()
{
	Widget.call(this);

	this.value = 0;
	this.min_value = 0;
	this.max_value = 100;
	this.speed = 1;
	this.steps = 0;
	this.markers = 0;
	this.continuous = false;
	this.type = Dial.ARROW;
	this.increment_dragging = false; //if true, when dragging will increment/decrement, not change to pos

	//0 is UP, Math.PI/2 is RIGHT, -Math.PI/2 is LEFT
	this.start_angle = -135;
	this.total_angle = 270;
}

Dial.prototype.__proto__ = Widget.prototype;
WIDGETS.Dial = Dial;

Dial.ARROW = 1;
Dial.BLOCK = 2;
Dial.LINE = 3;
Dial.KNOB = 4;

Dial.prototype.drawWidget = function( ctx )
{
	ctx.fillStyle = this.flags.active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)";
	ctx.strokeStyle = "white";
	var r = this.size[0] * 0.5;

	ctx.beginPath();
	ctx.arc( this.size[0] * 0.5, this.size[1] * 0.5, this.size[0]*0.5, 0, Math.PI * 2 );
	ctx.stroke();
	if(!this.flags.disabled && (this.flags.hover || this.flags.active))
		ctx.fill();

	if(this.onDrawBackground)
		this.onDrawBackground(ctx);

	if(this.markers)
	{
		ctx.strokeStyle = "white";
		var delta = this.total_angle / (this.markers-1);
		for(var i = 0; i < this.markers; ++i)
		{
			ctx.beginPath();
			var angle = this.start_angle + delta * i;
			var vector = vectorFromAngle(angle * DEG2RAD);
			var limit = Boolean(i == 0 || i == (this.markers-1));
			if (this.type == Dial.KNOB)
			{
				ctx.moveTo( r + vector[0]*(r*1.1), this.size[1] * 0.5 + vector[1]*(r*1.1));
				ctx.lineTo( r + vector[0]*(r*(limit?1.3:1.2)), this.size[1] * 0.5 + vector[1]*(r*(limit?1.3:1.2)));
			}
			else
			{
				ctx.moveTo( r + vector[0]*(r*(limit?0.8:0.9)), this.size[1] * 0.5 + vector[1]*(r*(limit?0.8:0.9)));
				ctx.lineTo( r + vector[0]*r, this.size[1] * 0.5 + vector[1]*r);
			}
			ctx.stroke();
		}
	}

	if( this.continuous )
		this.value = inrange( this.value, this.max_value)
	else
		this.value = Math.clamp( this.value, this.min_value, this.max_value );
	var angle = this.getAngle();
	/*
	var x = Math.cos( angle ) * r;
	var y = Math.sin( angle ) * r;
	ctx.beginPath();
	ctx.moveTo( this.size[0] * 0.5, this.size[1] * 0.5 );
	ctx.lineTo( this.size[0] * 0.5 + x, this.size[1] * 0.5 + y);
	ctx.stroke();
	*/

	ctx.fillStyle = "white";
	ctx.save();
	ctx.translate(this.size[0]*0.5,this.size[1]*0.5);
	ctx.rotate(angle * DEG2RAD);
	if(this.onDrawArrow)
		this.onDrawArrow(ctx);
	else
	{
		if(this.type == Dial.ARROW)
		{
			ctx.beginPath();
			ctx.moveTo(0,r*0.1);
			ctx.lineTo(-5,0);
			ctx.lineTo(0,-r);
			ctx.lineTo(5,0);
			ctx.fill();
		}
		else if (this.type == Dial.BLOCK)
		{
			ctx.strokeStyle = "white";
			ctx.beginPath();
			ctx.moveTo(-5,r*0.1);
			ctx.lineTo(5,r*0.1);
			ctx.lineTo(5,-r);
			ctx.lineTo(-5,-r);
			ctx.fill();
		}		
		else if (this.type == Dial.LINE)
		{
			ctx.strokeStyle = "white";
			ctx.beginPath();
			ctx.moveTo(0,r*0.1);
			ctx.lineTo(0,-r);
			ctx.stroke();
		}
		else if (this.type == Dial.KNOB)
		{
			ctx.beginPath();
			ctx.arc(0,-r*0.8,r*0.1,0,Math.PI*2);
			ctx.fill();
		}		
	}
	ctx.restore();

	if(this.onDrawForeground)
		this.onDrawForeground(ctx);
}

Dial.prototype.getMarkerDeltaAngle = function(num_markers)
{
	return this.total_angle / (num_markers-1);
}

Dial.prototype.getValue = function()
{
	var v = this.value;
	if( !this.steps )
		return v;
	var grid = (this.max_value - this.min_value) / (this.steps - 1);
	return Math.round(v / grid) * grid;
}

//in degrees
Dial.prototype.getAngle = function( value )
{
	var start_angle = this.start_angle;
	var total_angle = this.total_angle;
	if( this.continuous )
		total_angle = 360;
	if(value == null)
		value = this.getValue();
	var angle = remap( value, this.min_value, this.max_value, 0, total_angle );
	angle += start_angle;
	angle = angle % 360;
	if(angle < 0)
		angle += 360;
	return angle;
}

Dial.prototype.getHover = function(x,y)
{
	if(vec2.distance([x,y],[this.size[0]*0.5,this.size[1]*0.5]) > this.size[1]*0.5)
		return null;
	return this;
}

Dial.prototype.onMouse = function( e )
{
	var range = this.max_value - this.min_value;
	var old = this.getValue();

	if( e.type == "mousemove" )
	{
		if(!this.increment_dragging && !e.shiftKey )
		{
			this.setValueFromPosition([ e.mousex, e.mousey ])
		}
		else
		{
			var delta = range / 200;
			var inc = e.deltay * delta;
			this.value -= inc * this.speed;
		}
		var value = this.getValue(); //quantized value
		if(old != value)
			this.processValueChange( this, value, old );
		return true;
	}
	else if(e.type == "mousedown")
	{
		if(!this.increment_dragging && !e.shiftKey )
			this.setValueFromPosition([ e.mousex, e.mousey ])
		var value = this.getValue(); //quantized value
		if(old != value)
			this.processValueChange( this, value, old );
		return true;
	}
}

Dial.prototype.setValueFromPosition = function( pos )
{
	var range = this.max_value - this.min_value;
	var start_angle = this.start_angle;
	var total_angle = this.total_angle;
	if(this.continuous)
		total_angle = 360;
	var lpos = this.globalToLocal(pos);
	lpos[0] -= this.size[0]*0.5;
	lpos[1] -= this.size[1]*0.5;
	vec2.normalize(lpos,lpos);
	var angle = ((Math.atan2(lpos[0],-lpos[1]) / Math.PI) * 180) % 360;
	if(this.continuous && angle < 0)
		angle += 360;
	var f = (angle - start_angle) / total_angle;
	//console.log(angle,f);
	if(this.continuous && f > 1)//hack
		f-=1;
	if(!this.continuous)
		f = Math.clamp( f, 0, 1 );
	this.value = this.min_value + f * range;
	//console.log(this.value);
}

// SLIDER ***************************************

function Slider()
{
	Widget.call(this);

	this.value = 0;
	this.min_value = 0;
	this.max_value = 100;
	this.steps = 0;
	this.handler = Slider.BLOCK; //the object that marks the value
	this.reverse = false;
	this.fill = false;
	this.fill_color = "#556";
}

Slider.BLOCK = 0;
Slider.LINE = 1;
Slider.ARROW = 2;

Slider.prototype.__proto__ = Widget.prototype;
WIDGETS.Slider = Slider;

Slider.prototype.onMouse = function( e )
{
	var horizontal = this.size[0] > this.size[1];
	var s = this.size[ horizontal ? 1 : 0 ];
	var w = s*0.5;

	if( e.type == "mousemove" )
	{
		var pos = this.globalToLocal([e.mousex,e.mousey]);
		var s = this.size[ horizontal ? 1 : 0 ];
		var old = this.getValue();
		if( horizontal )
			this.value = remap(pos[0],w*0.5,this.size[0]-w*0.5,this.min_value,this.max_value);
		else
			this.value = remap(pos[1],w*0.5,this.size[1]-w*0.5,this.min_value,this.max_value);

		var value = this.getValue(); //quantized value
		if(old != value)
			this.processValueChange( this, value, old );
	
		return true;
	}
}

Slider.prototype.drawWidget = function( ctx )
{
	var value = this.getValue(); //clamped
	var reversed = this.max_value < this.min_value;

	var horizontal = this.size[0] > this.size[1];
	var s = this.size[ horizontal ? 1 : 0 ];
	var w = s*0.5;
	var total = this.size[ horizontal ? 0 : 1 ]; //total
	var f = remap( value, this.min_value, this.max_value, 0, 1);
	var foffset = f * total;
	var nf = reversed ? (1-f) : f;
	
	if(!this.flags.no_border)
	{
		ctx.fillStyle = this.flags.active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)";
		ctx.strokeStyle = "white";
		ctx.beginPath();
		ctx.rect( 0,0, this.size[0], this.size[1]);
		ctx.stroke();
	}

	if(!this.flags.disabled && (this.flags.hover || this.flags.active))
		ctx.fill();

	if(this.fill && nf != 0)
	{
		ctx.fillStyle = this.fill_color;
		var fill_length = nf * total;
		var offset = reversed ? (1-nf) * total : 0;
		if(horizontal)
			ctx.fillRect( 2,2, this.size[0]*f-4, this.size[1]-4);
		else
			ctx.fillRect( 2, offset+2, this.size[0]-4, fill_length-4);
	}

	if(this.markers)
	{
		ctx.fillStyle = "white";
		for(var i = 0; i < this.markers; ++i)
		{
			var delta = (horizontal ? this.size[0] : this.size[1]) / this.markers;
			if(horizontal)
				ctx.fillRect(delta*i-0.5,0,1,this.size[0]);
			else
				ctx.fillRect(0,delta*i-0.5,this.size[0]*0.5,1);
		}
	}

	ctx.fillStyle = "#FFF";

	if(this.handler == Slider.BLOCK || this.handler == Slider.LINE )
	{
		if(this.handler == Slider.LINE)
			w = 2;

		foffset = remap( value, this.min_value, this.max_value, w*0.5, total-w*0.5);
		//if(reversed)
		//	foffset = total - foffset;
		if( horizontal )
			ctx.fillRect( foffset - w*0.5,0,w,s );
		else
			ctx.fillRect( 0, foffset - w*0.5, s, w );
	}
	else if(this.handler == Slider.ARROW)
	{
		//if(reversed)
		//	foffset = total - foffset;
		ctx.beginPath();
		if( horizontal )
		{
			ctx.moveTo( foffset, s*0.25 );
			ctx.lineTo( foffset - w*0.5, s*0.5 );
			ctx.lineTo( foffset - w*0.5, s );
			ctx.lineTo( foffset + w*0.5, s );
			ctx.lineTo( foffset + w*0.5, s*0.5 );
		}
		else
		{
			ctx.moveTo( s*0.25, foffset );
			ctx.lineTo( s*0.5, foffset - w*0.5 );
			ctx.lineTo( s, foffset - w*0.5 );
			ctx.lineTo( s, foffset + w*0.5 );
			ctx.lineTo( s*0.5, foffset + w*0.5 );
		}
		ctx.closePath();
		ctx.fill();
	}

}

Slider.prototype.getValue = function()
{
	var v = this.value;
	if( this.steps )
	{
		var grid = (this.max_value - this.min_value) / (this.steps - 1);
		v = Math.round(v / grid) * grid;
	}
	if(this.max_value < this.min_value) //reversed
		return Math.clamp(v,this.max_value,this.min_value);
	return Math.clamp(v,this.min_value,this.max_value);
}