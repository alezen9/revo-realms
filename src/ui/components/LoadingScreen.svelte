<script lang="ts">
	import { onMount } from "svelte"
	import { eventsManager } from "../../systems"

	let progress = $state(0)

	let coreProgress = 0
	let resourcesProgress = 0

	onMount(() => {
		let unsubscribeCoreProgress = () => {}
		let unsubscribeResourcesProgress = () => {}
		const stopLoadingProgressSubscriptions = () => {
			unsubscribeCoreProgress()
			unsubscribeResourcesProgress()
			unsubscribeCoreProgress = () => {}
			unsubscribeResourcesProgress = () => {}
		}

		unsubscribeCoreProgress = eventsManager.on("engine-loading-core-progress", p => {
			coreProgress = Math.min(Math.ceil(p / 2), 50)
			progress = coreProgress + resourcesProgress
			if (progress === 100) stopLoadingProgressSubscriptions()
		})

		unsubscribeResourcesProgress = eventsManager.on("engine-loading-resources-progress", p => {
			resourcesProgress = Math.min(Math.ceil(p / 2), 50)
			progress = coreProgress + resourcesProgress
			if (progress === 100) stopLoadingProgressSubscriptions()
		})

		return () => {
			stopLoadingProgressSubscriptions()
		}
	})
</script>

<div class={progress === 100 ? "fade-out" : ""}>
	{progress}%
</div>

<style>
	div {
		color: white;
		background:
			radial-gradient(125% 100% at 12% 16%, rgba(48, 82, 64, 0.44), transparent 58%),
			radial-gradient(110% 90% at 85% 82%, rgba(46, 75, 88, 0.2), transparent 62%),
			linear-gradient(155deg, #0d1410 0%, #1f2426 48%, #151b1d 100%);
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
		animation: fadeOut 1s ease-out 80ms forwards;
		will-change: opacity;
	}

	@keyframes fadeOut {
		0% {
			visibility: visible;
			opacity: 1;
		}
		100% {
			visibility: hidden;
			opacity: 0;
		}
	}
</style>
