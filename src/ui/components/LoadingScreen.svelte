<script lang="ts">
	import { onMount } from "svelte"
	import { fade } from "svelte/transition"
	import { eventsManager } from "../../systems"

	let progress = $state(0)
	let hasFailed = $state(false)

	let coreProgress = 0
	let resourcesProgress = 0

	onMount(() => {
		let unsubscribes: VoidFunction[] = []
		const stopLoadingSubscriptions = () => {
			unsubscribes.forEach(unsubscribe => unsubscribe())
			unsubscribes = []
		}

		unsubscribes = [
			eventsManager.on("engine-loading-core-progress", p => {
				coreProgress = Math.min(Math.ceil(p / 2), 50)
				progress = coreProgress + resourcesProgress
				if (progress === 100) stopLoadingSubscriptions()
			}),
			eventsManager.on("engine-loading-resources-progress", p => {
				resourcesProgress = Math.min(Math.ceil(p / 2), 50)
				progress = coreProgress + resourcesProgress
				if (progress === 100) stopLoadingSubscriptions()
			}),
			eventsManager.on("engine-loading-failed", () => {
				hasFailed = true
				stopLoadingSubscriptions()
			}),
		]

		return stopLoadingSubscriptions
	})
</script>

{#if hasFailed}
	<div class="screen failed" in:fade={{ duration: 600 }}>
		<span class="headline">Something went wrong</span>
		<span class="hint">Please reload the page to try again</span>
	</div>
{:else if progress < 100}
	<div class="screen" out:fade={{ delay: 80, duration: 1000 }}>{progress}%</div>
{/if}

<style>
	.screen {
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
		justify-items: center;
		gap: 0.4em;
		font-size: 5em;
		font-family:
			"Gill Sans", "Gill Sans MT", Calibri, "Trebuchet MS", sans-serif;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	.failed {
		background:
			radial-gradient(125% 100% at 12% 16%, rgba(120, 42, 42, 0.5), transparent 58%),
			radial-gradient(110% 90% at 85% 82%, rgba(88, 46, 46, 0.28), transparent 62%),
			linear-gradient(155deg, #180d0d 0%, #2b1a1a 48%, #1d1414 100%);
		padding: 1em;
		text-align: center;
	}

	.headline {
		font-size: 0.4em;
	}

	.hint {
		font-size: 0.22em;
		opacity: 0.75;
	}
</style>
