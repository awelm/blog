showSubscribeModal = event => { 
    console.log(event.target);
    event.stopImmediatePropagation();
    var modal = document.getElementById("subscribeModal");
    var backdrop = document.getElementById("subscribeBackdrop");

    // Make modal visible
    modal.classList.add("show-modal");
    backdrop.classList.add("activeBackdrop");

    // If user either clicks X button OR clicks outside the modal window, then close modal
    document.onclick = function(event) {
        console.log(event.target);
        const isModalVisible = modal.classList.contains("show-modal");
        const isCloseModalClick = event.target.classList.contains("subscribeModalCloseButton"); 
        const outsideModalClick = !event.target || !event.target.closest("#subscribeModal"); 
        const isDismiss = isCloseModalClick || outsideModalClick; 
        if (isModalVisible && isDismiss) {
            modal.classList.remove("show-modal");
            backdrop.classList.remove("activeBackdrop");
        }
    } 
 }