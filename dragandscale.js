//Scale and Offset
function DragAndScale( element, skip_bind )
{
	//offset stored in world space
	this.offset = new Float32Array([0,0]);
	this.scale = 1;
	this.min_scale = 0.2;
	this.max_scale = 8;
	this.visual_scaling = 1; //used when rendering to low res textures
	this.onredraw = null;
	this.last_mouse = new Float32Array(2);

	if(element)
	{
		this.element = element;
		if(!skip_bind)
			this.bindEvents( element );
	}
}

DragAndScale.prototype.bindEvents = function( element )
{
	this._binded_mouse_callback = this.onMouse.bind(this);

	element.addEventListener("mousedown", this._binded_mouse_callback );
	element.addEventListener("mousemove", this._binded_mouse_callback );

	element.addEventListener("mousewheel", this._binded_mouse_callback, false);
	element.addEventListener("wheel", this._binded_mouse_callback, false);
}

DragAndScale.prototype.onMouse = function(e, skip_prevent_default)
{
	var canvas = this.element;
	var rect = canvas.getBoundingClientRect();
	var x = e.clientX - rect.left;
	var y = e.clientY - rect.top;
	e.canvasx = x;
	e.canvasy = y;
	e.dragging = this.dragging;

	var ignore = false;
	if(this.onmouse)
		ignore = this.onmouse(e);

	if(e.type == "mousedown" || e.type === "pointerdown")
	{
		this.dragging = true;
		canvas.removeEventListener("mousemove", this._binded_mouse_callback );
		document.body.addEventListener("mousemove", this._binded_mouse_callback  );
		document.body.addEventListener("mouseup", this._binded_mouse_callback );
	}
	else if(e.type == "mousemove" || e.type === "pointermove")
	{
		if(!ignore)
		{
			var deltax = x - this.last_mouse[0];
			var deltay = y - this.last_mouse[1];
			if( this.dragging )
				this.mouseDrag( deltax * this.visual_scaling, deltay * this.visual_scaling );
		}
	}
	else if(e.type == "mouseup" || e.type === "pointerup")
	{
		this.dragging = false;
		document.body.removeEventListener("mousemove", this._binded_mouse_callback );
		document.body.removeEventListener("mouseup", this._binded_mouse_callback );
		canvas.addEventListener("mousemove", this._binded_mouse_callback  );
	}
	else if(e.type == "mousewheel" || e.type == "wheel" || e.type == "DOMMouseScroll")
	{ 
		e.eventType = "mousewheel";
		if(e.type == "wheel")
			e.wheel = -e.deltaY;
		else
			e.wheel = (e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60);
		//from stack overflow
		e.delta = e.wheelDelta ? e.wheelDelta/40 : e.deltaY ? -e.deltaY/3 : 0;
		this.changeDeltaScale(1.0 + e.delta * 0.05);
	}

	this.last_mouse[0] = x;
	this.last_mouse[1] = y;

	if(!skip_prevent_default)
	{
		e.preventDefault();
		e.stopPropagation();
	}
	return false;
}

DragAndScale.prototype.toCanvasContext = function( ctx )
{
	ctx.scale( this.scale, this.scale );
	ctx.translate( this.offset[0], this.offset[1] );
}

DragAndScale.prototype.convertOffsetToCanvas = function(pos, scaling)
{
	scaling = scaling || 1;
	//return [pos[0] / this.scale - this.offset[0], pos[1] / this.scale - this.offset[1]];
	return [ ((pos[0] + this.offset[0]) * this.scale) * scaling, ((pos[1] + this.offset[1]) * this.scale) * scaling ];
}

DragAndScale.prototype.convertCanvasToOffset = function(pos, scaling)
{
	scaling = scaling || 1;
	return [ (pos[0] / scaling) / this.scale - this.offset[0] , 
		(pos[1] / scaling) / this.scale - this.offset[1]  ];
}

//NOT WORKING WELL!!!
DragAndScale.prototype.centerAt = function(pos)
{
	if(!this.element)
		return;
	var width = this.element.width * this.visual_scaling;
	var height = this.element.height * this.visual_scaling;
	var center = this.convertCanvasToOffset([width*0.5,height*0.5]);
	this.offset[0] += (center[0]-pos[0]);
	this.offset[1] += (center[1]-pos[1]);
	if(	this.onredraw )
		this.onredraw( this );
}

DragAndScale.prototype.mouseDrag = function(x,y)
{
	this.offset[0] += x / this.scale;
	this.offset[1] += y / this.scale;

	if(	this.onredraw )
		this.onredraw( this );
}

DragAndScale.prototype.changeScale = function( value, zooming_center )
{
	if(value < this.min_scale)
		value = this.min_scale;
	else if(value > this.max_scale)
		value = this.max_scale;

	if(value == this.scale)
		return;

	if(!this.element)
		return;

	var rect = this.element.getBoundingClientRect();
	if(!rect)
		return;

	zooming_center = zooming_center || [rect.width * 0.5 * this.visual_scaling,rect.height * 0.5 * this.visual_scaling];
	var center = this.convertCanvasToOffset( zooming_center );
	this.scale = value;

	var new_center = this.convertCanvasToOffset( zooming_center );
	var delta_offset = [new_center[0] - center[0], new_center[1] - center[1]];

	this.offset[0] += delta_offset[0];
	this.offset[1] += delta_offset[1];

	if(	this.onredraw )
		this.onredraw( this );
}

DragAndScale.prototype.changeDeltaScale = function( value, zooming_center )
{
	this.changeScale( this.scale * value, zooming_center );
}