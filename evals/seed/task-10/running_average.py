def running_average(numbers):
    """Return the cumulative running average after each element.

    For input [10, 20, 30], expected output: [10.0, 15.0, 20.0]
        (10/1, (10+20)/2, (10+20+30)/3)

    This implementation has two bugs. Both need to be fixed.
    """
    total = 0
    averages = []
    for i, n in enumerate(numbers):
        total += n
        count = i
        avg = count / total
        averages.append(avg)
    return averages
