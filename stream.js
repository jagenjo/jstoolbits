//used to save data continuously
function Stream( stream_or_size )
{
	if( stream_or_size )		
	{
		if( stream_or_size.constructor === Number ) //usually for writing
			this.data = new Uint8Array( stream_or_size + Stream.margin );
		else if ( stream_or_size.constructor === ArrayBuffer ) //reading
			this.data = new Uint8Array( stream_or_size ); 
		else if( stream_or_size.constructor === Uint8Array ) 
			this.data = stream_or_size; //no clone
		else
		{
			console.error("unkown stream info:", stream_or_size.constructor.name );
			throw("unkown stream info:", stream_or_size );
		}
	}
	else
		this.data = new Uint8Array( 1024*1024 ); //default
	
	this.index = 0;
	this.view = new DataView( this.data.buffer );
	this.length = this.data.length;
	this.little_endian = true;

	this.block_size_stack = []; //allows to go back to store the size of a block
}

var LiteStream = Stream;

Stream.margin = 1024 * 2;
Stream.DATA_EVENT = 0;
Stream.DATAFLOATS_EVENT = 1;

Stream.prototype.reset = function()
{
	this.check();
	this.index = 0;
	this.block_size_stack.length = 0;
}

Stream.prototype.check = function()
{
	if( isNaN( this.index ) )
		throw("NaN in events stream");
}

Stream.prototype.skip = function( num_bytes )
{
	this.index += num_bytes;
}

Stream.prototype.copyFrom = function( stream_or_data )
{
	if( stream_or_data.constructor == Uint8Array )
	{
		this.data = new Uint8Array( stream_or_data.length );
		this.view = new DataView( this.data.buffer );
		this.data.set( stream_or_data );
		this.length = stream_or_data.length;
		this.index = 0;
		return;
	}

	var stream = stream_or_data;
	if(this.data.length != stream.data.length)
	{
		this.data = new Uint8Array( stream.data.length );
		this.view = new DataView( this.data.buffer );
	}

	this.data.set( stream.data );
	this.length = stream.length;
	this.index = stream.index;
}

Stream.prototype.finalize = function()
{
	this.check();
	if(!this.index)
		return null;
	//hard to avoid GC, this has to be of a specific length
	var r = new Uint8Array( this.data.subarray(0, this.index) ); //clone
	this.index = 0;
	return r;
}

Stream.prototype.eof = function()
{
	//this.check();
	return this.index >= this.length;
}

Stream.prototype.resize = function( new_size )
{
	if(!new_size || new_size < this.length)
		throw("Stream cannot be resized to small size");

	var data = new Uint8Array( new_size + Stream.margin );
	data.set( this.data );
	this.data = data;
	this.view = new DataView( this.data.buffer );
	this.length = new_size;
}

//writing methods *****
Stream.prototype.writeFromDataDescription = function(object,description)
{
	for(var i = 0; i < description.length; ++i)
	{
		var info = description[i];
		var varname = info[0];
		var value = object[varname];
		if(value==null)
			throw("data missing from object when converting to stream");
		if( info[2] )
			this.writeArray(value);
		else
			switch(info[1])
			{
				case "Int8": this.writeInt8(value); break;
				case "Uint8": this.writeUint8(value); break;
				case "Int16": this.writeInt16(value); break;
				case "Uint16": this.writeUint16(value); break;
				case "Int32": this.writeUint32(value); break;
				case "Uint32": this.writeUint32(value); break;
				case "Float32": this.writeFloat32(value); break;
				case "Float64": this.writeFloat64(value); break;
				case "Array": this.writeArray(value); break;
			}
	}
}

Stream.prototype.writeParams = function( )
{
	var l = arguments.length;
	if( this.length < (this.index + l) )
		this.resize( this.length * 2 ); //double
	for(var i = 0; i < l; ++i)
		this.data[this.index + i] = arguments[i];
	this.index += l;
}

Stream.prototype.writeArray = function( array, fixed_size_in_bytes )
{
	var bytes = array.BYTES_PER_ELEMENT;
	if(fixed_size_in_bytes && fixed_size_in_bytes < (array.length * bytes) )
		throw("fixed size is not enough to store array");

	var l = fixed_size_in_bytes ? fixed_size_in_bytes : (array.length * bytes);
	if( this.length < (this.index + l) )
		this.resize( this.length * 2 ); //double WARNING: what if doubling is not enough?

	switch( array.constructor )
	{
		case Uint8Array:
		case Int8Array:
			this.data.set( array, this.index );
			break;
		case Int16Array:
			for(var i = 0; i < array.length; ++i)
				this.view.setInt16( this.index + i * 2, array[i], this.little_endian );
			break;
		case Uint16Array:
			for(var i = 0; i < array.length; ++i)
				this.view.setUint16( this.index + i * 2, array[i], this.little_endian );
			break;
		case Int32Array:
			for(var i = 0; i < array.length; ++i)
				this.view.setInt32( this.index + i * 4, array[i], this.little_endian );
			break;
		case Uint32Array:
			for(var i = 0; i < array.length; ++i)
				this.view.setUint32( this.index + i * 4, array[i], this.little_endian );
			break;
		case Float32Array:
			for(var i = 0; i < array.length; ++i)
				this.view.setFloat32( this.index + i * 4, array[i], this.little_endian );
			break;
		case Float64Array:
				for(var i = 0; i < array.length; ++i)
					this.view.setFloat64( this.index + i * 8, array[i], this.little_endian );
				break;
			case Array:
		default:
			throw("Stream only supports Uint8Array, Int8Array and Float32Array");
	}
	this.index += l;
}

//write stores and increases index
//set stores and doesnt change index

Stream.prototype.writeUint8 = function( v )
{
	if( this.length <= this.index + 1 )
		this.resize( this.length * 2 ); //double
	this.view.setUint8( this.index, v);
	this.index += 1;
}

Stream.prototype.setUint8 = function( v )
{
	this.view.setUint8( this.index, v);
}


Stream.prototype.writeInt8 = function( v )
{
	if( this.length <= this.index + 1 )
		this.resize( this.length * 2 ); //double
	this.view.setInt8( this.index, v);
	this.index += 1;
}

Stream.prototype.setInt8 = function( v )
{
	this.view.setInt8( this.index, v);
}

Stream.prototype.writeUint16 = function( v )
{
	if( this.length <= this.index + 2 )
		this.resize( this.length * 2 ); //double
	this.view.setUint16( this.index, v, this.little_endian);
	this.index += 2;
}

Stream.prototype.setUint16 = function( v )
{
	this.view.setUint16( this.index, v, this.little_endian);
}

Stream.prototype.writeInt16 = function( v )
{
	if( this.length <= this.index + 2 )
		this.resize( this.length * 2 ); //double
	this.view.setInt16( this.index, v, this.little_endian);
	this.index += 2;
}

Stream.prototype.setInt16 = function( v )
{
	this.view.setInt16( this.index, v, this.little_endian);
}

Stream.prototype.writeUint32 = function( v )
{
	if( this.length <= this.index + 4 )
		this.resize( this.length * 2 ); //double
	this.view.setUint32( this.index, v, this.little_endian);
	this.index += 4;
}

Stream.prototype.setUint32 = function( v )
{
	this.view.setUint32( this.index, v, this.little_endian);
}

Stream.prototype.writeInt32 = function( v )
{
	if( this.length <= this.index + 4 )
		this.resize( this.length * 2 ); //double
	this.view.setInt32( this.index, v, this.little_endian);
	this.index += 4;
}

Stream.prototype.setInt32 = function( v )
{
	this.view.setInt32( this.index, v, this.little_endian);
}

Stream.prototype.writeFloat32 = function( v )
{
	if( this.length <= this.index + 4 )
		this.resize( this.length * 2 ); //double
	this.view.setFloat32( this.index, v, this.little_endian);
	this.index += 4;
}

Stream.prototype.setFloat32 = function( v )
{
	this.view.setFloat32( this.index, v, this.little_endian);
}

Stream.prototype.writeFloat64 = function( v )
{
	if( this.length <= this.index + 8 )
		this.resize( this.length * 2 ); //double
	this.view.setFloat64( this.index, v, this.little_endian);
	this.index += 8;
}

Stream.prototype.setFloat64 = function( v )
{
	this.view.setFloat64( this.index, v, this.little_endian);
}

Stream.byte_offsets = {
	"Int8": 1,
	"Uint8": 1,
	"Int16": 2,
	"Uint16": 2,
	"Int32": 4,
	"Uint32": 4,
	"Float32": 4,
	"Float64": 8
};

Stream.prototype.skipFromDataDescription = function(object,description)
{
	for(var i = 0; i < description.length; ++i)
	{
		var info = description[i];
		var varname = info[0];
		var type = info[1];
		var bytes = Stream.byte_offsets[type];
		if( info[2] )
			bytes *= info[2];
		this.index += bytes;
	}
}

Stream.prototype.readFromDataDescription = function(object,description)
{
	for(var i = 0; i < description.length; ++i)
	{
		var info = description[i];
		var varname = info[0];
		if( info[2] )
			value = this.readArray(object[varname], info[2] ); 
		else
		{
			switch(info[1])
			{
				case "Int8": value = this.readInt8(); break;
				case "Uint8": value = this.readUint8(); break;
				case "Int16": value = this.readInt16(); break;
				case "Uint16": value = this.readUint16(); break;
				case "Int32": value = this.readUint32(); break;
				case "Uint32": value = this.readUint32(); break;
				case "Float32": value = this.readFloat32(); break;
				case "Float64": value = this.readFloat64(); break;
				case "Array": this.readArray( object[varname] ); break;
					continue;
					break;
				default:
					throw("wrong data type for stream");
			}
			object[varname] = value;
		}
	}
}

Stream.prototype.readBytes = function( bytes, clone )
{
	this.index += bytes;
	if(clone)
		return new Uint8Array( this.data.subarray( this.index - bytes, this.index ) );
	return this.data.subarray( this.index - bytes, this.index );
}

Stream.prototype.readFloat32Array = function( dest )
{
	for(var i = 0; i < dest.length; ++i )
		dest[i] = this.view.getFloat32( this.index + i * 4, this.little_endian);
	this.index += dest.length * 4;
}

//if will read according to the destination container
Stream.prototype.readArray = function( array, length )
{
	if( array.length == 0 && !length )
		throw("array must have a size");
	var l = length || array.length;
	var type = array.constructor;
	for(var i = 0; i < l; ++i)
	{
		switch(type)
		{
			case Uint8Array: array[i] = this.readUint8(); break;
			case Int8Array: array[i] = this.readInt8(); break;
			case Uint16Array: array[i] = this.readUint16(); break;
			case Int16Array: array[i] = this.readInt16(); break;
			case Uint32Array: array[i] = this.readUint32(); break;
			case Int32Array: array[i] = this.readInt32(); break;
			case Float32Array: array[i] = this.readFloat32(); break;
			case Float64Array: array[i] = this.readFloat64(); break;
			case Array:
				throw("array must be typed");
			default:
				throw("readArray type of array unknown");
		}
	}
}


Stream.prototype.readUint8 = function()
{
	this.index += 1;
	return this.view.getUint8( this.index - 1 );
}

Stream.prototype.getUint8 = function()
{
	return this.view.getUint8( this.index );
}

Stream.prototype.readInt8 = function()
{
	this.index += 1;
	return this.view.getInt8( this.index - 1 );
}

Stream.prototype.getInt8 = function()
{
	return this.view.getInt8( this.index );
}

Stream.prototype.readUint16 = function()
{
	this.index += 2;
	return this.view.getUint16( this.index - 2, this.little_endian);
}

Stream.prototype.getUint16 = function()
{
	return this.view.getUint16( this.index, this.little_endian);
}

Stream.prototype.readInt16 = function()
{
	this.index += 2;
	return this.view.getInt16( this.index - 2, this.little_endian);
}

Stream.prototype.getInt16 = function()
{
	return this.view.getInt16( this.index, this.little_endian);
}

Stream.prototype.readUint32 = function()
{
	this.index += 4;
	return this.view.getUint32( this.index - 4, this.little_endian );
}

Stream.prototype.getUint32 = function()
{
	return this.view.getUint32( this.index, this.little_endian );
}

Stream.prototype.readInt32 = function()
{
	this.index += 4;
	return this.view.getInt32( this.index - 4, this.little_endian );
}

Stream.prototype.getInt32 = function()
{
	return this.view.getInt32( this.index, this.little_endian );
}

Stream.prototype.readFloat32 = function()
{
	this.index += 4;
	return this.view.getFloat32( this.index - 4, this.little_endian );
}

Stream.prototype.getFloat32 = function()
{
	return this.view.getFloat32( this.index, this.little_endian );
}

Stream.prototype.readFloat64 = function()
{
	this.index += 8;
	return this.view.getFloat64( this.index - 8, this.little_endian );
}

Stream.prototype.getFloat64 = function()
{
	return this.view.getFloat64( this.index, this.little_endian );
}

//game specifics....

Stream.prototype.writeEventID = Stream.prototype.writeUint8;
Stream.prototype.writeID = Stream.prototype.writeUint32;

Stream.prototype.writeEventAndID = function(  event_id, id )
{
	if( this.length <= this.index + 4 )
		this.resize( this.length * 2 ); //double
	this.view.setUint8( this.index, event_id );
	this.view.setUint32( this.index + 1, id, this.little_endian );
	this.index += 5;
}


Stream.prototype.writeObject = function( object )
{
	object.writeToStream( this );
}

Stream.prototype.writeEventObject = function( event_id, event_data )
{
	this.view.setUint8( this.index, event_id );
	this.index += 1;
	event_data.writeToStream( this, event_id );
	if( this.length <= this.index + 4 )
		this.resize( this.length * 2 ); //double
}

//reads first a size value then as much bytes as the size specified
Stream.prototype.readString = function(num_bytes_size, big_endian )
{
	var tmp = this.little_endian;
	if( big_endian )
		this.little_endian = false;
	var size = 0;
	if(num_bytes_size == 4)
		size = this.readUint32();
	else if(num_bytes_size == 2)
		size = this.readUint16();
	else
		size = this.readUint8();
	this.little_endian = tmp;
	
	if(!size)
		return "";
	var arr = new Uint8Array(size);
	this.readArray(arr);
	var str = Stream.typedArrayToString(arr);


	return str;
}

Stream.prototype.writeEventData = function( data_type, data )
{
	if(data.length > 255)
		throw("cannot send data bigger than 255");
	if( this.length <= this.index + data.length + 4 )
		this.resize( this.length * 2 ); //double
	var view = this.view;
	view.setUint8( this.index, Stream.DATA_EVENT );
	view.setUint8( this.index+1, data_type );
	view.setUint8( this.index+2, data.length );
	view.setUint8( this.index+3, 0 ); //unused
	this.data.set( data, this.index + 4);
	this.index += data.length + 4;
}

Stream.prototype.writeEventDataFloats = function( data_type, data )
{
	if(data.length > 255)
		throw("cannot send data bigger than 255");
	if( this.length <= this.index + data.length * 4 + 4 )
		this.resize( this.length * 2 ); //double
	var view = this.view;
	view.setUint8( this.index, Stream.DATAFLOATS_EVENT );
	view.setUint8( this.index+1, data_type );
	view.setUint8( this.index+2, data.length );
	view.setUint8( this.index+3, 0 ); //unused
	for(var i = 0; i < data.length; ++i)
		view.setFloat32( this.index + i * 4 + 4, data[i], this.little_endian );
	this.index += data.length * 4 + 4;
}

//Warning: fixed_size means the total size (including str length) will measure N bytes, so it can store 
Stream.prototype.writeString = function( str, fixed_size )
{
	var arr = Stream.stringToUint8Array( String(str) );
	if(fixed_size && arr.length > (fixed_size - 2))
		throw("string is longer that fixed size block, remember that fixed size must include 2 extra bytes for str size");
	if(arr.length > 0xFFFF)
		throw("string has more than 65535 characters");
	this.writeUint16( fixed_size ? fixed_size - 2 : arr.length );
	if(arr.length)
		this.writeArray( arr, fixed_size ? fixed_size - 2 : null ); //2 where the size was stored
}

Stream.prototype.isEmpty = function()
{
	return this.index == 0;
}

Stream.prototype.pushBlockSize = function(bytes)
{
	bytes = bytes || 2;
	this.block_size_stack.push( this.index, bytes );
	this.index += bytes;
}

Stream.prototype.popBlockSize = function()
{
	var bytes =	this.block_size_stack.pop();
	var index =	this.block_size_stack.pop();
	var size = this.index - index - bytes;
	switch(bytes)
	{
		case 1: if(size > 0xFF) throw("size too big for one byte"); this.view.setUint8( index, size ); break;
		case 2: if(size > 0xFFFF) throw("size too big for two bytes"); this.view.setUint16( index, size, this.little_endian ); break;
		case 4: if(size > 0xFFFFFFFF) throw("size too big for four bytes"); this.view.setUint32( index, size, this.little_endian ); break;
	}
}

Stream.stringToUint8Array = function(str, fixed_length)
{
	var r = new Uint8Array( fixed_length ? fixed_length : str.length);
	var warning = false;
	for(var i = 0; i < str.length; i++)
	{
		var c = str.charCodeAt(i);
		if(c > 255)
			warning = true;
		r[i] = c;
	}

	if(warning)
		console.warn("WBin: there are characters in the string that cannot be encoded in 1 byte.");
	return r;
}

Stream.typedArrayToString = function(typed_array, same_size)
{
	var r = "";
	for(var i = 0; i < typed_array.length; i++)
		if (typed_array[i] == 0 && !same_size)
			break;
		else
			r += String.fromCharCode( typed_array[i] );
	//return String.fromCharCode.apply(null,typed_array)
	return r;
}

//** GAME STUFF */

/*
Stream.prototype.writeEventItemCreated = function( item )
{
	this.view.setUint8( this.index, ITEM_CREATED );
	this.view.setUint8( this.index + 1 , item.constructor.CLASS_ID );
	this.view.setUint32( this.index + 2 , item.block_id, this.little_endian );
	this.index += 6;
	item.writeToStream( this );
	if( this.length <= this.index )
		this.resize( this.length * 2 ); //double
}

Stream.prototype.writeEventItemUpdated = function( item )
{
	this.view.setUint8( this.index, ITEM_UPDATED );
	this.view.setUint32( this.index + 1 , item.block_id, this.little_endian );
	this.view.setUint32( this.index + 5 , item.id, this.little_endian );
	this.index += 9;
	item.writeToStream( this );
	if( this.length <= this.index )
		this.resize( this.length * 2 ); //double
}

Stream.prototype.writeEventItemRemoved = function( item )
{
	this.view.setUint8( this.index, ITEM_REMOVED );
	this.view.setUint32( this.index + 1 , item.block_id, this.little_endian );
	this.view.setUint32( this.index + 5 , item.id, this.little_endian );
	this.index += 9;
	if( this.length <= this.index )
		this.resize( this.length * 2 ); //double
}

Stream.prototype.writeEventCell = function( event_id, block_id, x, y, z, cellinfo )
{
	var view = this.view;
	view.setUint8( this.index, event_id );
	view.setUint32( this.index + 1, block_id, this.little_endian );
	view.setUint8( this.index + 4 + 1, x );
	view.setUint8( this.index + 5 + 1, y );
	view.setUint8( this.index + 6 + 1, z );
	for(var i = 0; i < World.cell_bytes; ++i)
		view.setUint8( this.index + 7 + 1 + i, cellinfo[i] );
	this.index += 8 + World.cell_bytes;
	if( this.length <= this.index )
		this.resize( this.length * 2 ); //double
}

//pass the event in case we send a BLOCK_CREATED or BLOCK_UPDATED
Stream.prototype.writeEventBlock = function( event_id, block )
{
	var view = this.view;
	view.setUint8( this.index, event_id );
	var block_data = block.toBinary();
	view.setUint32( this.index + 1, block_data.length, this.little_endian );

	if( this.length <= this.index + block_data.length + 5 )
		this.resize( this.length * 2 ); //double
	this.data.set( block_data, this.index + 5);
	this.index += block_data.length + 5;
}

//first event to store
Stream.prototype.writeEventWorld = function( world )
{
	if( this.length <= this.index + 32 )
		this.resize( this.length * 2 ); //double
	var view = this.view;
	var initial = this.index;
	
	view.setUint8( this.index, WORLD_EVENT );
	view.setUint16( this.index+1, 1, this.little_endian ); //version

	//1byte free
	view.setUint8( this.index+2, 0 ); //extra byte
	
	view.setUint32( this.index+4, world.info.seed, this.little_endian );
	view.setUint32( this.index+8, world.info.grid_size, this.little_endian );
	view.setUint8( this.index+12, world.global.max_height );

	//3bytes free
	view.setUint8( this.index+13, 0 ); //extra byte
	view.setUint8( this.index+14, 0 ); //extra byte
	view.setUint8( this.index+15, 0 ); //extra byte

	view.setUint32( this.index+16, world.total_cells_side, this.little_endian );
	view.setFloat32( this.index+20, world.time, this.little_endian );
	view.setFloat32( this.index+24, world.last_block_id, this.little_endian );

	//4 bytes free
	this.index = initial + 32;
}

Stream.prototype.readEventWorld = function( world )
{
	var view = this.view;
	var initial = this.index;
	
	var wversion = this.readUint16();
	console.log( "world version:", wversion );//1

	if( wversion == 1 )
	{
		this.readUint8();//3
		world.info.seed = this.readUint32();
		console.log( "wseed:", world.info.seed );
		world.info.grid_size = this.readUint32();
		world.global.max_height = this.readUint8();
		this.skip(3);
		world.total_cells_side = this.readUint32();
		world.time = this.readFloat32();
		world.last_block_id = this.readFloat32();
	}
	else
		throw("unknown world version:",wversion);

	this.index = initial + 31; //one byte for event type
}
*/

//****************** */

//nodejs
if(typeof(process) != "undefined")
{
	module.exports = Stream;
}




