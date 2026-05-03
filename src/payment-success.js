window.addEventListener("load", () => {
  const params = new URLSearchParams(window.location.search);

  const reference = params.get("reference") || params.get("trxref");

  if (!reference) return;

  window.history.replaceState({}, "", window.location.pathname);

  alert("Payment successful. Verifying order...");

  fetch(`http://localhost:5001/api/payments/verify/${reference}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert("Order confirmed ✅");

        // optional redirect to dashboard
        setTimeout(() => {
          window.location.href = "/dashboard.html";
        }, 1000);

      } else {
        alert("Payment verification failed");
      }
    })
    .catch(err => {
      console.error("Verification error:", err);
    });
});