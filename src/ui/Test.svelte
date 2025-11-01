<script lang="ts">
  // no props needed for now
</script>

<div class="center">Hello World</div>

<style>
  .center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font: 600 20px/1.2 system-ui, sans-serif;
    letter-spacing: 0.5px;
    padding: 12px 16px;
    border-radius: 8px;
    background: #0008;
    color: white;
    border: 1px solid #fff3;
    backdrop-filter: blur(6px);
    pointer-events: auto; /* clickable, if needed */
  }
</style>