import {data} from "./data.js";
import {canvasHeight, canvasWidth, drawShape} from "../ProfilePictureCreation.js";
import {showUserPopup} from "../main.js";
export default {
    methods: {showUserPopup},
    data() {
        return {
            data: data
        }
    },
    setup(props) {
        const canvasRef = Vue.ref(null)
        function drawShapes() {
            if (props.userid === -1) return
            if (!canvasRef.value) return
            let ctx = canvasRef.value.getContext('2d')
            let scale = canvasWidth/parseFloat($(canvasRef.value).attr('width'))
            ctx.fillStyle = "black"
            ctx.fillRect(0, 0, canvasWidth, canvasHeight)
            let shapes = data.loadedUsers.get(props.userid).profilePic
            if (!(shapes instanceof Map)) shapes = new Map(Object.entries(shapes))
            for (let shape of Array.from(shapes.values()).sort((a, b) => b.z - a.z)) {
                drawShape(ctx, shape, scale)
            }
        }
        Vue.onMounted(() => {
            drawShapes()
        })

        return { canvasRef, drawShapes }
    },
    template: `
      
      <div class='userPic' :style="'clip-path: circle(' + size / 2 + 'px at center); width: ' + size + 'px; height: ' + size + 'px;'">
        <canvas :width="size" :height="size" ref="canvasRef" @click="function(event) {showUserPopup($props.userid, event)}"></canvas>
      </div>
    `,
    props: {
        size: {
            type: Number,
            default: 50
        },
        userid: {
            type: Number,
            default: -1
        },
    },
    watch: {
        'profilePic'() {
            this.drawShapes()
        }
    },
    computed: {
        profilePic() {
            if (!data.loadedUsers.has(this.userid)) return []
            return Array.from(data.loadedUsers.get(this.userid).profilePic)
        }
    }
}