<script lang="ts">
	import Toggles from "./components/Toggles.svelte"
</script>

<div class="ui-root">
	<Toggles />
</div>

<style>
	.ui-root {
		position: fixed;
		inset: 0;
		pointer-events: none; /* pass-through by default */
	}
	/* Any child that needs interaction should set pointer-events:auto */
</style>
