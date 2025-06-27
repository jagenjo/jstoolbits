(function(global){
const ENABLED = 1
const LEFT = 1
const MIDDLEH = 2
const RIGHT = 4
const TOP = 8
const MIDDLEV = 16
const BOTTOM = 32
const TOPLEFT = TOP | LEFT
const CENTER = MIDDLEH | MIDDLEV

class Widget {
    static cursor = null
    static action = null

    _id = null
    label = ""
    area = [0,0,100,100] //x,y,w,h
    //anchor = TOPLEFT
    parent = null
    ui=null
    children = []
    enabled = true
    hover = false
    active = false
    focus = false
    draw(ctx,style){}
    onMouse(e) { return true }
    constructor(o){this.fromJSON(o);}
    set id(v){if(this.ui) throw "cannot change id if already has an UI"; this._id = v}
    get id(){return this._id}
    get width(){return this.area[2]}
    set width(v){this.area[2]=v}
    get height(){return this.area[3]}
    set height(v){this.area[3]=v}
    fromJSON(o){if(o) for(var i in o) this[i]=o[i]}
    add(w) {
        if(w.parent) throw "already has parent";
        this.children.push(w); w.parent = this;
        w.setUI(this.ui)
        return w
    }
    remove(w){let index = this.children.indexOf(w); if(index !== -1) { this.children.splice(index); w.parent = null; w.setUI(null)}}
    destroy(){this.parent?.remove(this)}
    setUI(ui){
        const oldui = this.ui
        this.ui=ui;
        if(this.id){
            if(ui) ui.widgets_by_id.set(this.id,this)
            else if(oldui) oldui.widgets_by_id.delete(this.id)
        }
        this.children.forEach(w=>w.setUI(ui));
    }
    getWidget(id){return this.ui?.widgets_by_id.get(id)}
    
    processMouse(m) //expect mouse in local to this widget
    {
        let used = this.onMouse(m)
        const x = m.localX
        const y = m.localY
        this.children.forEach((w)=>{
            if(w.enabled === false) return
            if(inArea(m.localX,m.localY,w.area))
            {
                m.localX -= w.area[0]
                m.localY -= w.area[1]
                used|=w.processMouse(m)
                m.localX = x
                m.localY = y
            }
        })
        return used
    }
    findWidgetAtPos(x,y){ //in local space of the parent
        if(!inArea(x,y,this.area))
            return null
        let offsetx = x-this.area[0]
        let offsety = y-this.area[1]
        if(this.offset){
            offsetx-= this.offset[0]
            offsety-= this.offset[1]
        }
        for(let i = this.children.length-1; i >= 0; i--)
        {
            const w = this.children[i]
            if(w.enabled === false) continue
            var inside = w.findWidgetAtPos(offsetx,offsety);
            if(inside) return inside;
        }
        return this
    }
    getOffset(){
        if(!this.parent)
            return [this.area[0],this.area[1]]
        var offset = this.parent.getOffset()
        offset[0] += this.area[0]
        offset[1] += this.area[1]
        return offset
    }
}

class StaticText extends Widget {
    linked = null
    constructor(o){super(o);this.linked = o.linked || null}
    draw(ctx,style){
        ctx.textAlign = style?.textAlign || "left"
        ctx.fillStyle = style?.textColor || "white"
        ctx.fillText( this.linked?.value.toFixed(2) || this.label, 0, this.area[3] * 0.65)
    }
}

class TextInput extends Widget {
    value = ""
    constructor(o){ super(); this.fromJSON(o) }
    draw(ctx,style){
        const [x,y,w,h] = this.area       
        ctx.strokeStyle = style?.textBorder || "white"
        ctx.strokeRect(0,0,w,h)
        if(this.hover) ctx.strokeRect(1,1,w-2,h-2)
        ctx.textAlign = "left"
        ctx.fillStyle = style?.textColor || "white"
        ctx.fillText( "> " + this.value + (this.focus && ((performance.now()/500)%1<0.5)? "_" : ""), 4, this.area[3] * 0.65)
    }

    onKey(e)
    {
        if(e.type !== "keydown")
            return
        if(e.code === "Enter")
        {
            this.ui.focusOn(null)
            if(this.onEnter)
                this.onEnter(this.value,this)
        }
        else if(e.code === "Backspace")
        {
            this.value = this.value.slice(0,-1)
            if(this.onChange)
                this.onChange(this.value, this)
        }
        else if(e.key.length === 1)
        {
            this.value += e.key
            if(this.onChange)
                this.onChange(this.value, this)
        }
    }
}

class Button extends Widget {
    icon = null
    constructor(o){ super(); this.fromJSON(o) }
    draw(ctx,style){
        const [x,y,w,h] = this.area
        let bgColor = this.hover ? (style?.buttonBgHover || "transparent") : (style?.buttonBg || "black")
        if(this.active) bgColor = (style?.buttonBgActive || "white")
        ctx.fillStyle = bgColor
        ctx.fillRect(0,0,w,h)
        ctx.strokeStyle = style?.buttonBorder || "white"
        ctx.strokeRect(0,0,w,h)
        if(this.hover) ctx.strokeRect(1,1,w-2,h-2)
        ctx.textAlign = "center"
        ctx.fillStyle = this.active ? "black" : "white"
        ctx.fillText( this.label, w/2 + (this.icon?8:0), h * 0.65)
        if(this.icon)
            this.ui.drawIcon(ctx,this.icon,this.label ? 8 : w/2-8,h/2-8,this.active)
    }
    onMouse(e)
    {
        if(e.type === "pointerdown" && this.onClick)
            this.onClick(this,e)
        return true
    }
}

class Slider extends Widget {
    value = 0
    range = [0,1]
    display = false
    binsize = 20
    constructor(o){ super(); this.fromJSON(o) }
    draw(ctx,style){
        const [x,y,w,h] = this.area       
        ctx.fillStyle = "black"
        ctx.fillRect(0,0,w,h)
        ctx.strokeStyle = "white"
        ctx.strokeRect(0,0,w,h)
        if(this.hover || this.active) ctx.strokeRect(1,1,w-2,h-2)
        var v = remap(this.value,this.range[0],this.range[1],0,Math.max(w,h)-this.binsize)
        ctx.fillStyle = "white"
        if(w>h)
            ctx.fillRect(v,0,this.binsize,h)
        else
            ctx.fillRect(0,v,w,this.binsize)
        if( this.display )
        {
            ctx.textAlign = "left"
            ctx.fillText( this.value.toFixed(2), this.area[2] + 10, this.area[3] * 0.6 )
        }
    }

    onMouse(m)
    {
        if(this.active)
        {
            var oldvalue = this.value
            if(this.area[2] > this.area[3])
                this.value = clamp( remap(m.localX,0,this.area[2]-this.binsize,this.range[0],this.range[1]), ...this.range )
            else
                this.value = clamp( remap(m.localY,0,this.area[3]-this.binsize,this.range[0],this.range[1]), ...this.range )
            if(this.onChange && oldvalue !== this.value)
                this.onChange(this.value, this, oldvalue)
        }
        return true
    }
}

class Checkbox extends Widget {
    value = false
    constructor(o){ super(); this.fromJSON(o) }
    draw(ctx,style){
        const [x,y,w,h] = this.area       
        var binsize = h/2;
        var margin = Math.floor(binsize/2)
        ctx.fillStyle = "white"
        ctx.textAlign = "left"
        ctx.fillText(this.label,10,h*0.6)
        ctx.strokeStyle = "white"
        if(this.hover) ctx.strokeRect(w-margin-binsize-1,margin-1,binsize+2,binsize+2)
        if(this.value)
            ctx.fillRect(w-margin-binsize,margin,binsize,binsize)
        else
        {
            ctx.strokeRect(w-margin-binsize,margin,binsize,binsize)
        }
    }

    onMouse(m)
    {
        const [x,y,w,h] = this.area       
        var binsize = h/2;
        var margin = Math.floor(binsize/2)
        var oldvalue = this.value
        if(m.type === "pointerdown")// && inArea(m.localX,m.localY,[w-margin-binsize,margin,binsize,binsize]))
        {
            if(this.onChange && oldvalue !== this.value)
                this.onChange(this.value, this, oldvalue)
            this.value = !this.value
        }
        return true
    }
}

class ComboBox extends Widget {
    contextMenu = null
    constructor(o){ super(); this.fromJSON(o) }
    draw(ctx,style){
        const [x,y,w,h] = this.area       
        ctx.fillStyle = this.active ? (style?.buttonBgActive || "white") : (style?.buttonBg || "black")
        ctx.fillRect(0,0,w,h)
        ctx.strokeStyle = style?.buttonBorder || "white"
        ctx.strokeRect(0,0,w,h)
        if(this.hover) ctx.strokeRect(1,1,w-2,h-2)
        ctx.textAlign = "center"
        ctx.fillStyle = this.active ? "black" : "white"
        let label = this.values[this.value]
        if(label.constructor !== String && label.label)
            label = label.label
        ctx.fillText( label, w/2, h * 0.65)
        ctx.fillText( String.fromCharCode( this.contextMenu ? 0x000025B2 : 0x000025BC ) , w-10, h * 0.65)
        if(this.contextMenu)
        {
            const offset = this.getOffset();
            this.contextMenu.area = [offset[0],offset[1]+this.area[3],this.area[2], this.values.length * 20]
        }
    }
    onMouse(e)
    {
        if(e.type === "pointerdown")
        {
            if(!this.contextMenu)
            {
                const offset = this.getOffset();
                this.contextMenu = new ContextMenu({selected: this.value, values: this.values, area:[offset[0],offset[1]+this.area[3],this.area[2],0]});
                this.contextMenu.onChange = (index)=>{
                    this.value = index
                    this.contextMenu = this.contextMenu.destroy()
                }
                this.ui.add(this.contextMenu)
            }
            else
            {
                this.contextMenu.destroy()
                this.contextMenu = null
            }
        }
        return true
    }    
}

class Frame extends Widget {
    img = null
    constructor(o){ super(); this.fromJSON(o); if(o.url){this.img = new Image(); this.img.src = o.url;} }
    draw(ctx,style) {
        //bg
        const [x,y,w,h] = this.area
        ctx.fillStyle = style?.frameBg || "black"
        ctx.fillRect(0,0,w,h)

        //content
        ctx.save()
        ctx.beginPath();
        ctx.rect(0,0,w,h)
        ctx.clip()
        if(this.img && this.img.width)
            ctx.drawImage(this.img,0.5,0.5)
        if(this.onDrawContent)
            this.onDrawContent(ctx,style,this)
        ctx.restore()

        //border
        ctx.strokeStyle = style?.frameBorder || "white"
        ctx.strokeRect(0,0,w,h)
    }
}

class Panel extends Widget {
    resizable = true
    movable = true
    closable = true
    titlebar = true
    offset = [0,0]
    constructor(o){ super(); this.fromJSON(o) }

    draw(ctx,style) {
        //bg
        const [x,y,w,h] = this.area
        ctx.fillStyle = style?.panelBg || "black"
        ctx.fillRect(0,0,w,h)

        if(this.children.length)
        {
            ctx.save()
            ctx.beginPath();
            ctx.rect(0,0,w,h)
            ctx.clip()
            this.children.forEach((w)=>{
                if(w.enabled === false) return
                ctx.save()
                ctx.translate(w.area[0]+this.offset[0],w.area[1]+this.offset[1])
                w.draw(ctx,w.style || style)
                ctx.restore()
            })
            ctx.restore()
        }

        //titlebar
        if(this.titlebar)
        {
            ctx.fillStyle = style?.panelTitleBg || "white"
            ctx.fillRect(0,0,w,20)
            ctx.fillStyle = style?.panelTitleText ||"black"
            ctx.fillText( this.label, 10, 15)

            if(this.closable)
            {
                ctx.fillStyle = "black"
                ctx.fillRect(w - 15,5,10,10)
            }
        }

        //border
        ctx.strokeStyle = style?.panelBorder || "white"
        ctx.strokeRect(0,0,w,h)
        if(this.active && ( this.movable || this.resizable) )
            ctx.strokeRect(1,1,w-2,h-2)
    }

    onMouse(e)
    {
        const [x,y,w,h] = this.area
        let action = null

        if(this.resizable && e.localX > (this.area[2] - 10) && e.localY > (this.area[3] - 10))
        {
            action = "resize"
            Widget.cursor = "nwse-resize"
        }
        else if(this.movable && e.localX < (this.area[2] - 20) && e.localY < 20)
        {
            action = "move"
            Widget.cursor = "move"
        }

        if(e.type === "pointerdown")
        {
            if(this.closable && inArea(e.localX,e.localY,[w - 15,5,10,10]))
            {
                action = null
                this.parent.remove(this)
            }
            
            Widget.action = action
        }

        if(e.type === "pointermove" && this.active)
        {
            if(Widget.action == "move")
            {
                this.area[0] += e.deltaX
                this.area[1] += e.deltaY
            }
            else if(Widget.action == "resize")
            {
                this.area[2] = Math.max( 20, e.localX )
                this.area[3] = Math.max( 20, e.localY )
            }
        }

        return true
    }
}

class ContextMenu extends Panel {
    values = []
    titlebar = false
    movable = false
    resizable = false

    constructor(o){
        super()
        this.fromJSON(o)
        this.area[3] = this.values.length * 20
        for(let i = 0; i < this.values.length; i++)
        {
            let label = this.values[i]
            if(label.constructor !== String && label.label)
                label = label.label
            var item = new Button({data:i,label,area:[1,i*20+1,this.area[2]-2,19],style:{buttonBgHover:"#222",buttonBorder:"transparent",buttonBg:i===this.selected?"#444":"transparent"}});
            item.onClick=(item)=>{if(this.onChange) this.onChange(item.data, item, this) }
            this.add(item)
        }
    }
}


class UI extends Widget {
    hoverWidget = null
    activeWidget = null
    focusWidget = null
    lastpos = [0,0]
    icons = null
    widgets_by_id = new Map()

    constructor(o){
        super();
        this.ui = this;
        if(o.icons)
        {
            this.icons = new Image()
            this.icons.src = o.icons
        }
    }
    draw(ctx,style) { 
        this.area[2] = ctx.canvas.width        
        this.area[3] = ctx.canvas.height
        ctx.font = "14px monospace"
        this.children.forEach((w)=>{
            if(w.enabled === false) return
            ctx.save()
            ctx.translate(w.area[0],w.area[1])
            w.draw(ctx,w.style||style)
            ctx.restore()
        })
        ctx.fillText( Widget.action || "", ctx.canvas.width/2,40)
        ctx.canvas.style.cursor = Widget.cursor || ""
    }
    drawIcon(ctx,index,x,y,reverse){
        if(!this.icons || !this.icons.width)
            return
        const ix = index%16
        const iy = Math.floor(index/16)
        if(reverse)
        {
            ctx.globalCompositeOperation = "difference"
            ctx.drawImage(this.icons,ix*16,iy*16,16,16,Math.floor(x)+0.5,Math.floor(y)+0.5,16,16)
            ctx.globalCompositeOperation = "source-over"
        }
        else
        ctx.drawImage(this.icons,ix*16,iy*16,16,16,Math.floor(x)+0.5,Math.floor(y)+0.5,16,16)
    }
    onMouse(e){
        const oldhover = this.hoverWidget
        const deltaX = e.offsetX - this.lastpos[0]
        const deltaY = e.offsetY - this.lastpos[1]
        Widget.cursor = null
        const x = e.offsetX, y = e.offsetY
        this.lastpos[0] = x || 0
        this.lastpos[1] = y || 0
        if(oldhover) oldhover.hover = false
        const mouse = { x, y, localX: x, localY: y, deltaX, deltaY, buttons: e.buttons, type: e.type }
        const w = this.hoverWidget = this.findWidgetAtPos(x,y);

        //handle active
        const oldactive = this.activeWidget

        if(e.type === "pointerdown")
        {
            this.focusOn(w)
            this.closeAllContextMenus();
    
            Widget.action = null
            if(this.activeWidget)
                this.activeWidget.active = false
            this.activeWidget = w
            if(this.activeWidget)
                this.activeWidget.active = true
        }

        let used = false
        if(this.activeWidget && e.type !== "pointerdown")
        {
            var offset = this.activeWidget.getOffset()
            mouse.localX -= offset[0]
            mouse.localY -= offset[1]
            used = this.activeWidget.processMouse(mouse)
        }
        else if(w)
        {
            w.hover = true
            var offset = w.getOffset()
            mouse.localX -= offset[0]
            mouse.localY -= offset[1]
            used = w.processMouse(mouse)
        }
        else
            used = false

        if(e.type === "pointerup")
        {
            Widget.action = null
            if(this.activeWidget)
                this.activeWidget.active = false
            this.activeWidget = null
        }

        return used
    }

    onKey(event) {
        if(this.focusWidget && this.focusWidget.onKey)
        {
            this.focusWidget.onKey(event);
            return true
        }
        return false
    }

    focusOn(w)
    {
        if(this.focusWidget)
            this.focusWidget.focus = false
        this.focusWidget = w
        if(this.focusWidget)
            this.focusWidget.focus = true
    }

    closeAllContextMenus()
    {
        for(let i = 0; i < this.children.length; i++)
        {
            const w = this.children[i]
            if(w instanceof ContextMenu)
            {
                w.destroy();
                i--;
            }
        }
    }

    demo() {
        var p = new Panel({label:"Panel", area:[100,100,500,500]})
        this.add(p)
        p.add( new StaticText({label:"Hello World", area:[10,30,100,30]}))
        p.add( new Button({id:"toggle",label:"Clickme", icon:4, area:[10,70,100,30], style: {buttonBg:"blue"}}))
        p.add( new Button({icon:5, area:[120,70,30,30]})).onClick = (b,e)=>{
            this.add(new ContextMenu({values:["foo","faa","fii"],area:[e.x,e.y,200,0]})).onChange = (v,i,c)=>{
                console.log(v)
                c.destroy()
            }
        }
        p.add( new Slider({value:0.5, area:[10,110,100,30],display: true}))
        p.add( new Slider({value:0.5, area:[p.area[2]-20,20,20,p.height-20],display: true}))
        p.add( new Checkbox({label: "checkbox", value:true, area:[10,150,100,30]}))
        p.add( new TextInput({value:"hello world", area:[10,190,140,30]}))
        p.add( new ComboBox({values:["Hello","World","Everybody",{label:"Extra", values:["Foo","Faa"]}],value:0, area:[10,230,140,30]}))
        p.add( new Frame({id:"frame",value:0.5, area:[200,40,256,256],url:"icons-1bit.png"}) ).onDrawContent = function(ctx){
            const offset = this.getOffset()
            let x = Math.floor((this.ui.lastpos[0]-offset[0])/16)
            let y = Math.floor((this.ui.lastpos[1]-offset[1])/16)
            if(x > 16 || y > 16 || x < 0 || y < 0) return
            ctx.strokeStyle="yellow"
            ctx.strokeRect(x*16,y*16,16,16)
            ctx.fillStyle = "white"
            ctx.fillText(y*16+x,10,this.area[3]-20)
        }
        this.getWidget("toggle").onClick = ()=>{const f = this.getWidget("frame"); f.enabled = !f.enabled}
    }
}

function inPositiveBox(x,y,w,h) { return x >= 0 && y >= 0 && x < w && y < h }
function inArea(x,y,area) { return  x >= area[0] && y >= area[1] && x < area[0] + area[2] && y < area[1] + area[3] }
function remap(v,low1,high1,low2,high2) { return (v - low1)/(high1-low1)*(high2-low2)+low2}
function clamp(v,min,max) { return v < min ? min : (v > max ? max : v)}

global.CUI = {
    UI,
    Panel,
    Widget,
    Button,
    Slider,
    StaticText,
    TextInput,
    ComboBox,
    Frame,
    TOP,MIDDLEV,BOTTOM,LEFT,MIDDLEH,RIGHT,TOPLEFT,CENTER
}

})(this)