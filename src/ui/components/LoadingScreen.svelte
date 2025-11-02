<script lang="ts">
	import { onMount } from "svelte"
	import { eventsManager } from "../../systems"

	let progress = $state(0)
	let coreProgress = $state(0)
	let resourcesProgress = $state(0)

	$effect(() => {
		progress = coreProgress + resourcesProgress
	})

	onMount(() => {
		eventsManager.on("engine-loading-core-progress", p => {
			coreProgress = Math.min(Math.ceil(p / 2), 50)
		})
		eventsManager.on("engine-loading-resources-progress", p => {
			resourcesProgress = Math.min(Math.ceil(p / 2), 50)
		})
	})
</script>

<div class={progress === 100 ? "fade-out" : ""}>
	{progress}%
</div>

<style>
	div {
		color: white;
		background-color: black;
		width: 100%;
		height: 100%;
		display: grid;
		place-content: center;
		font-size: 5em;
		font-family:
			"Gill Sans", "Gill Sans MT", Calibri, "Trebuchet MS", sans-serif;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	.fade-out {
		animation: fadeOut 1.75s ease-out forwards;
	}

	@keyframes fadeOut {
		75% {
			visibility: visible;
			opacity: 1;
			display: grid;
		}
		100% {
			visibility: hidden;
			opacity: 0;
			display: none;
		}
	}
</style>
