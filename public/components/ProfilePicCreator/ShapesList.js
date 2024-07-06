import {data} from "../data.js";
// import {sortedShapes} from "../../ProfilePictureCreation.js";

export default {
    data() {
        return {
            data: data,
            lastSortedShapes: []
        }
    },
    template: `
      <div id="shapesList">
        <shape-item v-if="data.profilePictureOpen" v-for="shape in sortedShapes()" :shape="shape"></shape-item>
      </div>
    `,
    mounted() {
        this.sortable()
    },
    updated() {
        $('#shapesList').sortable('refresh')
    },
    methods: {
        sortable() {
            $('#shapesList').sortable({
                stop: function(event, ui) {
                    event.preventDefault()
                    let sorted = $(this).sortable('toArray', { attribute: 'data-shapeID' })
                    for (let i = 0; i < sorted.length; i++) {
                        data.shapes.get(parseInt(sorted[i])).z = i + 2
                    }

                }
            })
        },
        sortedShapes() {
            return Array.from(data.shapes.values()).sort((a, b) => a.z - b.z)
        }
    },
}