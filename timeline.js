//Agnostic timeline, do nos impose any timeline content
//it renders to a canvas
"use strict";

(function(global){

function Timeline()
{
	this.current_time = 0;
	this.framerate = 30;
	this.opacity = 0.8;
	this.sidebar_width = 200;
	this.top_margin = 20;

	//do not change, it will be updated when called draw
	this.duration = 100;
	this.position = [0,0];
	this.size = [300,150];

	this.current_scroll = 0; //in percentage
	this.current_scroll_in_pixels = 0; //in pixels
	this.scrollable_height = 0; //true height of the timeline content

	this._seconds_to_pixels = 100;
	this._pixels_to_seconds = 1/this._seconds_to_pixels;
	this._canvas = null;
	this._grab_time = 0;
	this._start_time = 0;
	this._end_time = 1;

	this._last_mouse = [0,0];

	this._tracks_drawn = [];

	this.onDrawContent = null; //onDrawContent( ctx, time_start, time_end, timeline );
}

global.Timeline = Timeline;

Object.defineProperty( Timeline.prototype, "height", {
	get: function() { return this.size[1]; },
	set: function(v) { this.size[1] = v; }
});

//project must have .duration in seconds
Timeline.prototype.draw = function( ctx, project, current_time, rect )
{
	if(!project)
		return;

	if(!rect)
		rect = [0, ctx.canvas.height - 150, ctx.canvas.width, 150 ];

	this._canvas = ctx.canvas;
	this.position[0] = rect[0];
	this.position[1] = rect[1];
	var w = this.size[0] = rect[2];
	var h = this.size[1] = rect[3];
	var P2S = this._pixels_to_seconds;
	var S2P = this._seconds_to_pixels;
	var timeline_height = this.size[1];

	this.current_time = current_time;
	var duration = this.duration = project.duration;
	this.current_scroll_in_pixels = this.scrollable_height <= h ? 0 : (this.current_scroll * (this.scrollable_height - timeline_height));

	ctx.save();
	ctx.translate( this.position[0], this.position[1] + this.top_margin ); //20 is the top margin area

	//background
	ctx.fillStyle = "#000";
	ctx.globalAlpha = this.opacity * 0.5;
	ctx.fillRect(0,-this.top_margin,w,this.top_margin);
	ctx.globalAlpha = this.opacity;
	ctx.fillRect(0,0,w,h);
	ctx.globalAlpha = 1;

	//seconds markers
	var seconds_full_window = (w * P2S); //how many seconds fit in the current window
	var seconds_half_window = seconds_full_window * 0.5;
	var hw = w * 0.5; //half width

	//time in the left side (current time is always in the middle)
	var time_start = current_time - seconds_half_window;
	//if(time_start < 0)
	//	time_start = 0;

	//time in the right side
	var time_end = current_time + seconds_half_window;
	//if(time_end > duration )
	//	time_end = duration;

	this._start_time = time_start;
	this._end_time = time_end;

	var sidebar = this.sidebar_width;
	this._last_ref = null; //used while rendering tracks

	//this ones are limited to the true timeline (not the visible area)
	var start = Math.ceil( Math.max(0,time_start) );
	var end = Math.floor( Math.min(duration,time_end) + 0.01 );
	
	//calls using as 0,0 the top-left of the tracks area (not the top-left of the timeline but 20 pixels below)
	this._tracks_drawn.length = 0;

	if(this.onDrawContent)
		this.onDrawContent( ctx, time_start, time_end, this );

	//scrollbar
	if( h < this.scrollable_height )
	{
		ctx.fillStyle = "#222";
		ctx.fillRect( w - 10, 0, h, 10 );
		var scrollh = h * (h / this.scrollable_height);
		ctx.fillStyle = "#AAA";
		ctx.fillRect( w - 8, this.current_scroll * (h - scrollh), 6, scrollh );
	}

	//where do we start drawing
	var start_x = this.timeToX(start);
	var end_x = this.timeToX(end);

	//frame lines
	if(S2P > 200)
	{
		ctx.strokeStyle = "#444";
		ctx.globalAlpha = (S2P - 200) / 400;
		ctx.beginPath();
		var pixels_per_frame = S2P / this.framerate;
		var x = Math.round( this.timeToX( Math.floor(time_start * this.framerate) / this.framerate));
		var num_frames = (time_end - time_start ) * this.framerate + 1;
		for(var i = 0; i < num_frames; ++i)
		{
			ctx.moveTo( Math.round(x) + 0.5, 0);
			ctx.lineTo( Math.round(x) + 0.5, 10);
			x += pixels_per_frame;
		}
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	//vertical lines
	ctx.strokeStyle = "#444";
	ctx.beginPath();
	var linex = this.timeToX( 0 );
	if( linex > sidebar )
	{
		ctx.moveTo( linex, this.top_margin + 0.5);
		ctx.lineTo( linex, h );
	}
	var linex = this.timeToX( duration );
	if( linex > sidebar && linex < w )
	{
		ctx.moveTo( linex, this.top_margin + 0.5);
		ctx.lineTo( linex, h );
	}
	ctx.stroke();

	//horizontal line
	ctx.strokeStyle = "#AAA";
	ctx.beginPath();
	ctx.moveTo( Math.max(sidebar, this.timeToX( Math.max(0,time_start) ) ), 0.5);
	ctx.lineTo( Math.min(w, this.timeToX( Math.min(duration,time_end) ) ), 0.5);
	var delta_seconds = 1;
	if( this._seconds_to_pixels < 50)
		delta_seconds = 10;

	//mini lines
	for(var t = start; t <= end; t += 1 )
	{
		if( t % delta_seconds != 0)
			continue;
		var x = Math.floor((this.timeToX(t))|0) + 0.5;
		if(x < sidebar || (x+0.01) > w)
			continue;
		ctx.moveTo( x, 0);
		ctx.lineTo( x, 18);
	}
	ctx.stroke();

	//

	//numbers
	ctx.fillStyle = "#FFF";
	ctx.font = "12px Tahoma";
	ctx.textAlign = "center";
	for(var t = start; t <= end; t += 1 )
	{
		if( t % delta_seconds != 0 )
			continue;
		ctx.globalAlpha = t % 10 == 0 ? 1 : Math.clamp( (this._seconds_to_pixels - 50) * 0.01,0,0.7);
		var x = ((this.timeToX(t))|0) + 0.5;
		if( x > sidebar-10 && x < (w + 10))
			ctx.fillText(String(t),x,-5);
	}
	ctx.globalAlpha = 1;

	//current time marker
	ctx.strokeStyle = "#FFF";
	var x = ((w*0.5)|0) + 0.5;
	ctx.globalAlpha = 0.5;
	ctx.fillStyle = "#AAA";
	ctx.fillRect( x-2,1,4,h);
	ctx.globalAlpha = 1;
	ctx.beginPath();
	ctx.moveTo( x,1);
	ctx.lineTo( x,h);
	ctx.stroke();

	ctx.fillStyle = "#FFF";
	ctx.beginPath();
	ctx.moveTo( x - 4,1);
	ctx.lineTo( x + 4,1);
	ctx.lineTo( x,6);
	ctx.fill();

	ctx.restore();
}

Timeline.prototype.drawMarkers = function( ctx, markers )
{
	//render markers
	ctx.fillStyle = "white";
	ctx.textAlign = "left";
	var markers_pos = [];
	for(var i = 0; i < markers.length; ++i)
	{
		var marker = markers[i];
		if( marker.time < this._start_time - this._pixels_to_seconds * 100 ||
			marker.time > this._end_time )
			continue;
		var x = this.timeToX( marker.time );
		markers_pos.push(x);
		ctx.save();
		ctx.translate( x, 0 );
		ctx.rotate( Math.PI * -0.25 );
		ctx.fillText( marker.title, 20, 4 );
		ctx.restore();
	}

	if( markers_pos.length )
	{
		ctx.beginPath();
		for(var i = 0; i < markers_pos.length; ++i)
		{
			ctx.moveTo( markers_pos[i] - 5, 0 );
			ctx.lineTo( markers_pos[i], -5 );
			ctx.lineTo( markers_pos[i] + 5, 0 );
			ctx.lineTo( markers_pos[i], 5 );
			ctx.lineTo( markers_pos[i] - 5, 0 );
		}
		ctx.fill();
	}
}

//helper function, you can call it from onDrawContent to render all the keyframes
Timeline.prototype.drawTrackWithKeyframes = function( ctx, y, track_height, title, subtitle, track, track_index, prev_ref, bullet_callback )
{
	track_index = track_index || 0;
	var margin_left = 0;

	if( track_index % 2 )
	{
		ctx.fillStyle = "rgba(255,255,255,0.1)";
		ctx.fillRect( 0, y, this.size[0], track_height );
	}

	if(track.enabled === false)
		ctx.globalAlpha = 0.4;

	if( bullet_callback )
	{
		ctx.fillStyle = "#AAA";
		ctx.fillRect( 12, y+6, 14, 14 );
		margin_left += 28;
	}

	this._track_bullet_callback = bullet_callback || null;
	this._tracks_drawn.push([track,y+this.top_margin,track_height]);

	ctx.font = Math.floor( track_height * 0.7) + "px Arial";
	ctx.textAlign = "left";
	ctx.fillStyle = "rgba(255,255,255,0.8)";

	if(prev_ref && prev_ref != this._last_ref)
		ctx.fillText( title, margin_left + 10, y + track_height * 0.75 );
	this._last_ref = prev_ref;

	if(subtitle != null)
	{
		var info = ctx.measureText( title );
		ctx.fillStyle = "rgba(100,180,255,0.8)";
		ctx.fillText( subtitle, margin_left + 10 + info.width, y + track_height * 0.75 );
	}

	ctx.fillStyle = "rgba(220,200,150,1)";
	var keyframes = track.data;

	if(keyframes)
		for(var j = 0; j < keyframes.length; ++j)
		{
			var keyframe = keyframes[j];
			var time = keyframe[0];
			var value = keyframe[1];
			if( time < this._start_time || time > this._end_time )
				continue;
			var keyframe_posx = this.timeToX( time );
			if( keyframe_posx > this.sidebar_width )
				ctx.fillRect( keyframe_posx - 4, y + 4, 8, track_height - 8);
		}

	ctx.globalAlpha = 1;
}

//converts a time to 
Timeline.prototype.xToTime = function( x, global )
{
	if( global )
		x -= this.position[0];
	var v = (x - this.size[0] * 0.5) * this._pixels_to_seconds + this.current_time;
	return v;
}

Timeline.prototype.timeToX = function( t, framerate, global )
{
	if( framerate )
		t = Math.round( t * framerate ) / framerate;
	var x = (t - this.current_time) * this._seconds_to_pixels + this.size[0] * 0.5;
	if (global)
		x += this.position[0];
	return x;
}

Timeline.prototype.getCurrentFrame = function( framerate )
{
	return Math.floor( this.current_time * framerate );
}

Timeline.prototype.setScale = function(v)
{
	this._seconds_to_pixels = v;
	if( this._seconds_to_pixels > 1000 )
		this._seconds_to_pixels = 1000;
	this._pixels_to_seconds = 1/this._seconds_to_pixels;		
}

Timeline.prototype.processMouse = function(e)
{
	if(!this._canvas)
		return;

	var w = this.size[0];
	var h = this.size[1];

	//process mouse
	var x = e.offsetX;
	var y = e.offsetY;
	e.deltax = x - this._last_mouse[0];
	e.deltay = y - this._last_mouse[1];
	var local_x = e.offsetX - this.position[0];
	var local_y = e.offsetY - this.position[1];
	this._last_mouse[0] = x;
	this._last_mouse[1] = y;
	var timeline_height = this.size[1];

	var time = this.xToTime(x, true);

	var is_inside = x >= this.position[0] && x <= (this.position[0] + this.size[0]) &&
					y >= this.position[1] && y <= (this.position[1] + this.size[1]);

	var track = null;
	for(var i = this._tracks_drawn.length - 1; i >= 0; --i)
	{
		var t = this._tracks_drawn[i];
		if( local_y >= t[1] && local_y < (t[1] + t[2]) )
		{
			track = t[0];
			break;
		}
	}
	e.track = track;

	if( e.type == "mouseup" )
	{
		this._grabbing = false;
		this._grabbing_scroll = false;
		//e.click_time = getTime() - this._click_time;
		if( this.onMouseUp )
			this.onMouseUp(e,time);
	}

	if ( !is_inside && !this._grabbing && !(e.metaKey || e.altKey ) )
		return;

	if( this.onMouse && this.onMouse( e, time, this ) )
		return;

	if( e.type == "mousedown")
	{
		this._click_time = getTime();

		if(this._track_bullet_callback && e.track)
			this._track_bullet_callback(e.track,e,this,[local_x,local_y]);

		if( timeline_height < this.scrollable_height && x > w - 10)
		{
			this._grabbing_scroll = true;
		}
		else
		{
			this._grabbing = true;
			this._grab_time = time - this.current_time;
			//console.log("grabbing at",this._grab_time);
		}
	}
	else if( e.type == "mousemove" )
	{
		//console.log(time);

		if( e.dragging && this._grabbing )
		{
			var curr = time - this.current_time;
			var delta = curr - this._grab_time;
			this._grab_time = curr;
			//console.log( "grab_time",this._grab_time);
			this.current_time = Math.max(0,this.current_time - delta);
			if( this.onSetTime )
				this.onSetTime( this.current_time );
		}
		else if( e.dragging && this._grabbing_scroll )
		{
			var scrollh = timeline_height * (timeline_height / this.scrollable_height);
			this.current_scroll = Math.clamp( this.current_scroll + e.movementY / timeline_height, 0, 1);
		}

		if( !e.dragging )
			this._grabbing = false;
	}
	else if( e.type == "wheel" )
	{
		if( timeline_height < this.scrollable_height && x > w - 10)
		{
			this.current_scroll = Math.clamp( this.current_scroll + (e.wheelDelta < 0 ? 0.1 : -0.1), 0, 1);
		}
		else
		{
			this.setScale( this._seconds_to_pixels * (e.wheelDelta < 0 ? 0.9 : (1/0.9)) );
		}
	}

	if(this._canvas)
	{
		var cursor = this._grabbing ? "grabbing" : "pointer" ;//"grab";
		this._canvas.style.cursor = cursor;
		//this._canvas.style.cursor = "-webkit-" + cursor;
	}

	return true;
};

})( typeof(window) != "undefined" ? window : (typeof(self) != "undefined" ? self : global ) );

// end of Timeline.js
