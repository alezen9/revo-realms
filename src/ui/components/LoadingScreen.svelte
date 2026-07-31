<script lang="ts">
	import { onMount } from "svelte"
	import { fade } from "svelte/transition"
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

{#if progress < 100}
	<div out:fade={{ delay: 80, duration: 1000 }}>{progress}%</div>
{/if}

<style>
	div {
		color: white;
		background:
			radial-gradient(125% 100% at 12% 16%, rgba(48, 82, 64, 0.44), transparent 58%),
			radial-gradient(110% 90% at 85% 82%, rgba(46, 75, 88, 0.2), transparent 62%),
			linear-gradient(155deg, #0d1410 0%, #1f2426 48%, #151b1d 100%);
		position: fixed;
		inset: 0;
		z-index: 30;
		display: grid;
		place-content: center;
		font-size: 5em;
		font-family:
			"Gill Sans", "Gill Sans MT", Calibri, "Trebuchet MS", sans-serif;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}
</style>
