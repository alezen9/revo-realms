<script lang="ts">
	import Test from "./Test.svelte"
</script>

<div class="ui-root">
	<Test />
</div>

<style>
	.ui-root {
		position: fixed;
		inset: 0;
		z-index: 9999;
		pointer-events: none; /* pass-through by default */
	}
	/* Any child that needs interaction should set pointer-events:auto */
</style>
