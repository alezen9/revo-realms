<script lang="ts">
	import { onMount } from "svelte"
	import { eventsManager } from "../../systems"

	let animation = $state("")

	onMount(() => {
		eventsManager.on("game-wind-start", () => {
			animation = "fade-in"
		})

		eventsManager.on("game-wind-end", () => {
			animation = "fade-out"
		})
	})
</script>

<svg
	viewBox="0 0 24 24"
	height="1em"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	class={animation}
>
	<path
		d="M3 8h2m2-2.14286V5.5C7 4.11929 8.11929 3 9.5 3 10.8807 3 12 4.11929 12 5.5S10.8807 8 9.5 8H8m-4 6h1m10 3v.5c0 1.933 1.567 3.5 3.5 3.5s3.5-1.567 3.5-3.5-1.567-3.5-3.5-3.5H9m-7-3h6m7-3v-.5C15 5.567 16.567 4 18.5 4S22 5.567 22 7.5 20.433 11 18.5 11h-6.25"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
	/>
</svg>

<style>
	svg {
		position: absolute;
		top: 15%;
		left: 50%;
		transform: translate(-50%, 50%);
		font-size: 7.5em;
		color: rgba(255, 255, 255, 0.35);
		opacity: 0;
		visibility: hidden;
	}

	@keyframes fadeIn {
		from {
			transform: translate(-50%, 50%);
			opacity: 0;
			visibility: hidden;
		}
		to {
			transform: translate(-50%, -15%);
			opacity: 1;
			visibility: visible;
		}
	}

	@keyframes fadeOut {
		from {
			transform: translate(-50%, -15%);
			opacity: 1;
			visibility: visible;
		}
		to {
			transform: translate(-50%, 50%);
			opacity: 0;
			visibility: hidden;
		}
	}

	.fade-in {
		animation: fadeIn 0.5s forwards;
	}

	.fade-out {
		animation: fadeOut 1s forwards;
	}
</style>
