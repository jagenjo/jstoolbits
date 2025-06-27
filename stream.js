/* 
Stream class to write or read sequential data in an ArrayBuffer, for sync data over the network
It supports normalization in ranges
Javi Agenjo 2025 
*/

class Stream
{
	index = 0
	length = 0
	little_endian = true
	block_size_stack = []; //allows to go back to store the size of a block
	data = null //Uint8Array
	view = null //dataview

	constructor( stream_or_size )
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
		
		this.view = new DataView( this.data.buffer );
		this.length = this.data.length;
	}
}

var LiteStream = Stream;

Stream.margin = 1024 * 2;
Stream.DATA_EVENT = 0;
Stream.DATAFLOATS_EVENT = 1;
Stream.DATA_MAXRANGE = { u8: 0xFF, uint8: 0xFF, u16: 0xFFFF, uint16: 0xFFFF, u32: 0xFFFFFFFF, uint32: 0xFFFFFFFF }
Stream.BYTE_OFFSETS = {
	"i8":1,
	"int8": 1,
	"u8":1,
	"uint8": 1,
	"i16": 2,
	"int16": 2,
	"u16": 2,
	"uint16": 2,
	"i32": 4,
	"int32": 4,
	"u32": 4,
	"uint32": 4,
	"f32":4,
	"float32": 4,
	"f64":8,
	"float64": 8
};

Stream.DATATYPE_CTOR = {
	"i8": Int8Array,
	"int8": Int8Array,
	"u8": Uint8Array,
	"uint8": Uint8Array,
	"i16": Int16Array,
	"int16": Int16Array,
	"u16": Uint16Array,
	"uint16": Uint16Array,
	"i32": Int32Array,
	"int32": Int32Array,
	"u32": Uint32Array,
	"uint32": Uint32Array,
	"f32": Float32Array,
	"float32": Float32Array,
	"f64": Float64Array,
	"float64": Float64Array
}


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

function convertValueToNormalized( value, min, max, type )
{
	let range = max - min
	let maxRange = Stream.DATA_MAXRANGE[ type ]
	if(maxRange)
		value = (value - min) / (range / maxRange)
	return value
}

function convertNormalizedToValue( value, min, max, type )
{
	let range = max - min
	let maxRange = Stream.DATA_MAXRANGE[ type ]
	if(maxRange)
		value = value / (maxRange / range) + min
	return value
}


//writing methods *****
/* usage
[
	["varname","dataType", size?, [min,max]? ]
]
*/
Stream.prototype.writeFromDataDescription = function(object,description)
{
	description = description || object["@struct"]
	if(!description)
		throw "no description supplied"
	for(var i = 0; i < description.length; ++i)
	{
		var info = description[i];
		var varname = info[0];
		var dataType = info[1];
		var count = info[2];
		var dataRange = info[3];
		if(!varname)
		{
			this.index += count;
			continue;
		}

		var value = object[varname];
		if(value==null)
			throw("data missing from object when converting to stream");
		if( count && count > 1 ) //for typed arrays
		{
			if(dataRange) //if ranged, normalize the value in the range
			{
				for(let j = 0; j < count; j++)
				{
					let nvalue = convertValueToNormalized( value[j], dataRange[0], dataRange[1], dataType )
					switch(dataType)
					{
						case "u8":
						case "uint8": this.writeUint8(nvalue); break;
						case "u16":
						case "uint16": this.writeUint16(nvalue); break;
						case "u32":
						case "uint32": this.writeUint32(nvalue); break;
						default: throw "range types require integer types"
					}
				}
			}
			else if( dataType === "string")
				this.writeFixedString( value, count )
			else //type is preserved
			{
				if(value.constructor === Array)
					value = new Stream.DATATYPE_CTOR[dataType](value);
				this.writeArray(value);
			}
		}
		else
		{
			if(dataRange) //range
				value = convertValueToNormalized(value, dataRange[0], dataRange[1], dataType)
	
			switch(dataType)
			{
				case "i8":
				case "int8": this.writeInt8(value); break;
				case "u8":
				case "uint8": this.writeUint8(value); break;
				case "i16":
				case "int16": this.writeInt16(value); break;
				case "u16":
				case "uint16": this.writeUint16(value); break;
				case "i32":
				case "int32": this.writeInt32(value); break;
				case "u32":
				case "uint32": this.writeUint32(value); break;
				case "f32":
				case "float32": this.writeFloat32(value); break;
				case "f64":
				case "float64": this.writeFloat64(value); break;
				case "array": this.writeArray(value); break; //only for typed arrays
			}
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
	var bytes = array.BYTES_PER_ELEMENT || 1;
	if(fixed_size_in_bytes && fixed_size_in_bytes < (array.length * bytes) )
		throw("fixed size is not enough to store array");

	var l = fixed_size_in_bytes ? fixed_size_in_bytes : (array.length * bytes);
	if( this.length < (this.index + l) )
		this.resize( this.length * 2 ); //double WARNING: what if doubling is not enough?

	switch( array.constructor )
	{
		case String:
			for(var i = 0; i < array.length; ++i)
				this.view.setUint8( this.index + i, array.charCodeAt(i), this.little_endian );
			break;
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
			throw("Stream only supports Typed Arrays");
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

Stream.prototype.skipFromDataDescription = function(object,description)
{
	for(var i = 0; i < description.length; ++i)
	{
		var info = description[i];
		var varname = info[0];
		var type = info[1];
		var bytes = Stream.BYTE_OFFSETS[type];
		if( info[2] )
			bytes *= info[2];
		this.index += bytes;
	}
}

Stream.prototype.readFromDataDescription = function(target,description)
{
	description = description || target["@struct"]
	if(!description)
		throw "no description supplied"
	if(!target)
	target = {}
	for(var i = 0; i < description.length; ++i)
	{
		var info = description[i];
		var varname = info[0];
		var dataType = info[1];
		var count = info[2];
		var dataRange = info[3];

		if(!varname)
		{
			this.index += count;
			continue;
		}		

		if( count && count > 1 ) //has fixed size
		{
			let target_array = target[varname]
			if(!target_array && dataType !== "string")
				target[varname] = target_array = new Stream.DATATYPE_CTOR[dataType](count)
			if(dataRange) //normalized
			{
				for(let j = 0; j < count; j++)
				{
					let nvalue = 0
					switch(dataType)
					{
						case "i8":
						case "int8": nvalue = this.readInt8(); break;
						case "u8":
						case "uint8": nvalue = this.readUint8(); break;
						case "i16":
						case "int16": nvalue = this.readInt16(); break;
						case "u16":
						case "uint16": nvalue = this.readUint16(); break;
						case "i32":
						case "int32": nvalue = this.readUint32(); break;
						case "u32":
						case "uint32": nvalue = this.readUint32(); break;
						default:
							throw("wrong data type for ranged typed array in stream");
					}
					target_array[j] = convertNormalizedToValue(nvalue, dataRange[0], dataRange[1], dataType)
				}
			}
			else if( dataType === "string" )
			{
				target[varname] = this.readFixedString( count );
			}
			else
			{
				this.readArray( target_array, count ); 
			}
		}
		else
		{
			let value = 0
			switch(dataType)
			{
				case "i8":
				case "int8": value = this.readInt8(); break;
				case "u8":
				case "uint8": value = this.readUint8(); break;
				case "i16":
				case "int16": value = this.readInt16(); break;
				case "u16":
				case "uint16": value = this.readUint16(); break;
				case "i32":
				case "int32": value = this.readUint32(); break;
				case "u32":
				case "uint32": value = this.readUint32(); break;
				case "f32":
				case "float32": value = this.readFloat32(); break;
				case "f64":
				case "float64": value = this.readFloat64(); break;
				case "array": this.readArray( target[varname] ); break;
				default:
					throw("wrong data type for stream");
			}
			if(info[3]) //range
				value = convertNormalizedToValue(value, dataRange[0], dataRange[1], dataType)

			target[varname] = value;
		}
	}

	return target
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

//reads a basic 1 byte per char string
Stream.prototype.readFixedString = function( num_chars )
{
	let str = ""
	var final_index = this.index + num_chars;
	for(let i = 0; i < num_chars; i++)
	{
		let c = this.readUint8();
		if(c === 0)
			break;
		str += String.fromCharCode(c);
	}
	this.index = final_index;
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

//only for byte strings
Stream.prototype.writeFixedString = function( str, num_chars )
{
	for(let i = 0; i < num_chars; i++)
		this.writeUint8( str.charCodeAt(i) || 0 );
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

Stream.unitTest = function()
{
	var obj = {
		myInt: 1,
		myString: "javi",
		myNumber: 0.5,
		myNumberNorm: 0.5,
		myVector: [1,2,3],
		myTypedVector: new Float32Array([1,2,3,4,5]),
		junk: -1,
	}

	var struct = [
		["myInt","u32"],
		["myString","string",32],
		["myNumber","f32"],
		["myNumberNorm","u8",1,[0,1]],
		["myVector","u8",3],
		[null,null,1], //padding
		["myTypedVector","f32",5],
	]

	var stream = new Stream();
	stream.writeFromDataDescription( obj, struct );
	stream.index = 0
	var result = stream.readFromDataDescription( null, struct );
	console.log(obj, result)
}

//****************** */

//nodejs
if(typeof(process) != "undefined")
{
	module.exports = Stream;
}




