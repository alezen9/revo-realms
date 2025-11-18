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

<!-- <svg
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
</svg> -->

<svg
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 110 82"
	height="1em"
	class={animation}
>
	<path
		d="M89.9661 37.514c.7325-4.5954.3304-7.9889-2.3354-11-3.0931-3.5413-7.1157-4.651-13.1646-4-5.6187-12.54706-13.1107-20.13404-25.5-19.99998-10.4176-.33677-17.9591 5.45425-25.5 13.49998-12.6528.043-19.54264 8.5721-20.88932 20.5-.79861 10.5262 4.63891 18.1462 15.38932 20.5h79c15.9369-.0319 12.4999 29-8 21-4.7558-2.4884-5.9988-4.8698-5.5-11m-43-1.5h33c6.3865 1.1156 3.5 11-2.5 9-1.5376-.5117-2.5273-1.3193-4.5-3.5m-12-21.5h46.9999c9.539-3.0414 0-15.5-6.4999-6"
		stroke="currentColor"
		stroke-width="4"
		stroke-linecap="round"
		stroke-linejoin="round"
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
