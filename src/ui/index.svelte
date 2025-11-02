<script lang="ts">
	import LoadingScreen from "./components/LoadingScreen.svelte"
	import Toggles from "./components/Toggles.svelte"
	import WindIcon from "./components/WindIcon.svelte"

	const IS_LOADING_SCREEN_ENABLED = import.meta.env.PROD || true // tweak boolean for dev
</script>

<div class="ui-root">
	<Toggles />
	{#if IS_LOADING_SCREEN_ENABLED}
		<LoadingScreen />
	{/if}
	<WindIcon />
</div>

<style>
	.ui-root {
		position: fixed;
		inset: 0;
		pointer-events: none; /* pass-through by default */
	}
	/* Any child that needs interaction should set pointer-events:auto */
</style>
