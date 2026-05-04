window.addEventListener("load", () => {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference") || params.get("trxref");

  if (!reference) return;

  // Clean URL
  window.history.replaceState({}, "", window.location.pathname);

  fetch(`https://data-bundle-backend.onrender.com/api/payments/verify/${reference}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // ✅ Store success message
        sessionStorage.setItem("orderStatus", "success");
        sessionStorage.setItem("orderMessage", "Order placed successfully ✅");
      } else {
        // ❌ Store failure message
        sessionStorage.setItem("orderStatus", "failed");
        sessionStorage.setItem("orderMessage", "Payment verification failed ❌");
      }

      // Redirect ALWAYS after verification
      window.location.href = "/megabyte.html";
    })
    .catch(err => {
      console.error("Verification error:", err);

      sessionStorage.setItem("orderStatus", "failed");
      sessionStorage.setItem("orderMessage", "Something went wrong ❌");

      window.location.href = "https://megabytestation.vercel.app/";
    });
});